import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import {
  Question,
  QuestionVote,
  VoteVerification,
} from "../../../../lib/models";
import { requireParticipant } from "../../../../lib/viewer";
import { createLogger } from "../../../../lib/logger";
import { runtimeEnv } from "../../../../lib/bankid/config";
import { startBankIdSession } from "../../../../lib/bankid/session";
import { QUOTA_MESSAGE, canVote } from "../../../../lib/vote-quota";
import { checkStartThrottle } from "../../../../lib/bankid/rate-limit";
import { appRedirectFor, clientHint } from "../../../../lib/bankid/client-hint";

const log = createLogger("MobileVoteVerification");

/**
 * A BankID order lives about 3 minutes. Inside that window a second tap on
 * "Rösta med BankID" is the user coming back to an order that is still live, so
 * they get the same one rather than a competing order — and we do not pay for a
 * second signature.
 */
const IN_FLIGHT_WINDOW_MS = 3 * 60 * 1000;

/**
 * Deep-link schemes the app may ask GrandID to return the browser to.
 *
 * Allowlisted rather than passed through: GrandID appends `?grandidsession=…`
 * to whatever it is given, so an arbitrary callback would hand that id to a
 * third-party host. It is not enough on its own to do anything — GetSession
 * needs our apiKey and serviceKey too — but there is no reason to leak it.
 *
 * `exp://` is how Expo Go addresses a development machine; it cannot appear in
 * a store build, where the scheme is the app's own.
 */
const ALLOWED_RETURN_PREFIXES = [
  "vallentunaframat://",
  "exp://",
  "https://www.vallentuna.app/",
  "https://vallentuna.app/",
];

/**
 * GrandID rejects `scheme:///path` (three slashes) with
 * INCORRECT_CALLBACK_URL_DATA, and that is exactly what some deep-link builders
 * emit. Verified against the live API 2026-08-25.
 */
function normaliseReturnUrl(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const url = value.replace(":///", "://");
  return ALLOWED_RETURN_PREFIXES.some((prefix) => url.startsWith(prefix))
    ? url
    : "";
}

/** What BankID displays and signs. This text is what binds the voter. */
function ballotText(questionText: string, choice: string): string {
  const answer = choice === "ja" ? "JA" : "NEJ";
  return (
    `Du röstar ${answer} på:\n\n"${questionText}"\n\n` +
    "Vallentuna Framåt — din röst registreras när du signerat."
  );
}

/**
 * POST /api/mobile/vote-verification
 *
 * Starts a BankID signing order for one ballot and returns the URL the app
 * opens. The ballot is recorded here, before the user sees BankID, so the
 * choice cannot be changed after they have been shown one.
 *
 * Nothing about the vote is written yet — see lib/bankid/settle.ts.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const viewer = await requireParticipant(req, res);
  if (!viewer) return;

  const { questionId, choice, returnUrl } = req.body || {};
  if (!questionId) return res.status(400).json({ message: "questionId krävs" });
  if (!["ja", "nej"].includes(choice))
    return res.status(400).json({ message: "Ogiltigt val" });

  try {
    await connectDB();

    // Check what we can before spending a BankID signature on it.
    const question: any = await Question.findById(questionId)
      .select("text status")
      .lean();
    if (!question)
      return res.status(404).json({ message: "Frågan finns inte" });
    if (question.status !== "active") {
      return res
        .status(403)
        .json({ message: "Den här frågan är stängd för röstning." });
    }

    // Changing an existing vote is free and always allowed; this only guards
    // the case where a verified vote already exists and nothing would change.
    const existing: any = await QuestionVote.findOne({
      questionId,
      userId: viewer.userId,
    })
      .select("choice verifiedAt")
      .lean();
    if (existing && existing.verifiedAt && existing.choice === choice) {
      return res.status(409).json({
        message: "Du har redan signerat den här rösten.",
      });
    }

    // Every accepted order is a billable signature, so this is a cost control as
    // much as an abuse one.
    const throttle = await checkStartThrottle(viewer.userId);
    if (throttle.limited) {
      log.warn("Vote verification start throttled", { userId: viewer.userId });
      return res.status(429).json({
        message:
          "Du har startat för många BankID-signeringar. Försök igen om en stund.",
        retryAfter: throttle.retryAfter,
      });
    }

    // Checked before spending a signature. Settle checks again, because that is
    // where the vote is written and minutes pass in between.
    if (!(await canVote(viewer.userId, String(questionId)))) {
      return res.status(403).json({ message: QUOTA_MESSAGE });
    }

    const inFlight: any = await VoteVerification.findOne({
      userId: viewer.userId,
      status: "PENDING",
      createdAt: { $gt: new Date(Date.now() - IN_FLIGHT_WINDOW_MS) },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Only resumable if it is the same ballot — otherwise the live order is
    // showing different text from what the user just chose, and handing it back
    // would sign the wrong thing.
    if (
      inFlight &&
      inFlight.questionId.toString() === String(questionId) &&
      inFlight.choice === choice
    ) {
      log.info("Reusing in-flight verification", {
        verificationId: inFlight._id.toString(),
      });
      return res.status(200).json({
        verificationId: inFlight._id.toString(),
        redirectUrl: inFlight.redirectUrl,
        resumed: true,
      });
    }

    // An unusable or missing returnUrl is not an error: the signature still
    // works, the voter is just left on GrandID's completion page instead of
    // being carried back into the app.
    const callbackUrl = normaliseReturnUrl(returnUrl);
    if (returnUrl && !callbackUrl) {
      log.warn("Ignoring a returnUrl that is not an allowed deep link", {
        userId: viewer.userId,
      });
    }

    // Same destination, different journey: callbackUrl is where the browser
    // goes, appRedirect is where the BankID app goes. Which one gets the voter
    // home depends on the platform, and sending both strands Android — see
    // appRedirectFor, where that is measured rather than assumed.
    const platform = clientHint(req).platform;
    const started = await startBankIdSession({
      service: "sign",
      visibleText: ballotText(question.text, choice),
      callbackUrl,
      appRedirect: appRedirectFor(platform, callbackUrl),
    });

    // Created after the BankID call, unlike the Swish flow: GrandID hands us the
    // session id rather than taking ours, so there is nothing to reserve first.
    const verification = await VoteVerification.create({
      userId: viewer.userId,
      questionId,
      choice,
      grandIdSession: started.sessionId,
      redirectUrl: started.redirectUrl,
      status: "PENDING",
      runtime: runtimeEnv(),
    });

    log.info("Vote verification started", {
      verificationId: verification._id.toString(),
      questionId: String(questionId),
      runtime: runtimeEnv(),
    });

    return res.status(201).json({
      verificationId: verification._id.toString(),
      redirectUrl: started.redirectUrl,
      resumed: false,
    });
  } catch (error) {
    log.error("Failed to start vote verification", {
      userId: viewer.userId,
      error: error.message,
      code: error.code,
    });
    return res.status(502).json({
      message: "BankID kunde inte startas just nu. Försök igen om en stund.",
    });
  }
}
