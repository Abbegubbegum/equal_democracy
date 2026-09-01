import type { NextApiRequest, NextApiResponse } from "next";
import { requireParticipant } from "@/lib/viewer";
import connectDB from "@/lib/mongodb";
import { Question, QuestionVote, VoteVerification } from "@/lib/models";
import { csrfProtection } from "@/lib/csrf";
import { createLogger } from "@/lib/logger";
import { runtimeEnv } from "@/lib/bankid/config";
import {
  MIN_POLL_INTERVAL_MS,
  getBankIdSession,
  startBankIdSession,
} from "@/lib/bankid/session";
import { settleVerification } from "@/lib/bankid/settle";
import { getBaseUrl } from "@/lib/email";
import { QUOTA_MESSAGE, canVote } from "@/lib/vote-quota";
import { checkStartThrottle } from "@/lib/bankid/rate-limit";
import { appRedirectFor, clientHint } from "@/lib/bankid/client-hint";

const log = createLogger("WebVoteVerification");

/** A BankID order lives about 3 minutes; inside that, resume rather than restart. */
const IN_FLIGHT_WINDOW_MS = 3 * 60 * 1000;

const HINT_MESSAGES: Record<string, string> = {
  userCancel: "Du avbröt signeringen i BankID.",
  cancelled: "Signeringen avbröts.",
  expiredTransaction: "Signeringen tog för lång tid och avbröts.",
  startFailed: "BankID hann inte startas. Försök igen.",
  certificateErr: "Ditt BankID kunde inte användas. Kontakta din bank.",
};

/** What BankID displays and signs. This text is what binds the voter. */
function ballotText(questionText: string, choice: string): string {
  const answer = choice === "ja" ? "JA" : "NEJ";
  return (
    `Du röstar ${answer} på:\n\n"${questionText}"\n\n` +
    "Vallentuna Framåt — din röst registreras när du signerat."
  );
}

/**
 * BankID vote verification for the web.
 *
 * The browser leaves for GrandID's hosted page, so unlike the mobile flow
 * nothing can poll while the signature is happening. GrandID brings the voter
 * back to `/rosta?grandidsession=…` instead, and the page resolves the outcome
 * with the GET below — which is also where the vote gets written, by the same
 * `settleVerification` the app uses.
 *
 *   POST  start an order        → { verificationId, redirectUrl }
 *   GET   ?grandidsession=…     → poll + settle
 *
 * Keyed by GrandID's session id rather than ours because that is what the
 * redirect carries, and it is unique. Both are scoped to the signed-in user.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const viewer = await requireParticipant(req, res);
  if (!viewer) return;

  const userId = viewer.userId;

  if (req.method === "POST") return start(req, res, userId);
  if (req.method === "GET") return resolve(req, res, userId);
  return res.status(405).json({ message: "Method not allowed" });
}

async function start(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
) {
  if (!csrfProtection(req, res)) return;

  const { questionId, choice } = req.body || {};
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

    const existing: any = await QuestionVote.findOne({ questionId, userId })
      .select("choice verifiedAt")
      .lean();
    if (existing && existing.verifiedAt && existing.choice === choice) {
      return res
        .status(409)
        .json({ message: "Du har redan signerat den här rösten." });
    }

    // Every accepted order is a billable signature, so this is a cost control as
    // much as an abuse one.
    const throttle = await checkStartThrottle(userId);
    if (throttle.limited) {
      log.warn("Vote verification start throttled", { userId: userId });
      return res.status(429).json({
        message:
          "Du har startat för många BankID-signeringar. Försök igen om en stund.",
        retryAfter: throttle.retryAfter,
      });
    }

    // Checked before spending a signature. Settle checks again, because that is
    // where the vote is written and minutes pass in between.
    if (!(await canVote(userId, String(questionId)))) {
      return res.status(403).json({ message: QUOTA_MESSAGE });
    }

    const inFlight: any = await VoteVerification.findOne({
      userId,
      status: "PENDING",
      createdAt: { $gt: new Date(Date.now() - IN_FLIGHT_WINDOW_MS) },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Only resumable for the same ballot — a live order for a different
    // question is displaying text the voter did not just agree to.
    if (
      inFlight &&
      inFlight.questionId.toString() === String(questionId) &&
      inFlight.choice === choice
    ) {
      return res.status(200).json({
        verificationId: inFlight._id.toString(),
        redirectUrl: inFlight.redirectUrl,
        resumed: true,
      });
    }

    // Absolute https URL on our own origin. GrandID appends `?grandidsession=…`
    // to it, which is what the page reads on the way back — so this must stay
    // free of a query string of its own.
    const callbackUrl = `${getBaseUrl()}/rosta`;

    // On a phone browser the hosted page still hands off to the BankID app, so
    // the same platform split applies as in the app: iOS needs the appRedirect
    // or BankID returns to the wrong Safari tab, Android must not have it or the
    // Custom Tab never finishes GrandID's page. See appRedirectFor.
    const platform = clientHint(req).platform;
    const started = await startBankIdSession({
      service: "sign",
      visibleText: ballotText(question.text, choice),
      callbackUrl,
      appRedirect: appRedirectFor(platform, callbackUrl),
    });

    const verification = await VoteVerification.create({
      userId,
      questionId,
      choice,
      grandIdSession: started.sessionId,
      redirectUrl: started.redirectUrl,
      status: "PENDING",
      runtime: runtimeEnv(),
    });

    log.info("Web vote verification started", {
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
    log.error("Failed to start web vote verification", {
      userId,
      error: error.message,
      code: error.code,
    });
    return res.status(502).json({
      message: "BankID kunde inte startas just nu. Försök igen om en stund.",
    });
  }
}

async function resolve(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
) {
  const grandidsession = req.query.grandidsession;
  if (typeof grandidsession !== "string" || !grandidsession) {
    return res.status(400).json({ message: "grandidsession krävs" });
  }

  try {
    await connectDB();

    const verification: any = await VoteVerification.findOne({
      grandIdSession: grandidsession,
      userId,
    });
    // Scoped to the caller, and 404 rather than 403 so the endpoint cannot be
    // used to discover that someone else's session exists.
    if (!verification) {
      return res.status(404).json({ message: "Verifieringen finns inte" });
    }

    let message = "";
    let reasonCode = verification.reasonCode ?? null;

    if (verification.status === "PENDING") {
      const stale =
        !verification.lastPolledAt ||
        Date.now() - verification.lastPolledAt.getTime() >=
          MIN_POLL_INTERVAL_MS;

      if (stale) {
        verification.lastPolledAt = new Date();
        await verification.save();

        const bankId = await getBankIdSession(verification.grandIdSession, {
          service: "sign",
        });

        if (bankId.state === "complete") {
          const result = await settleVerification(verification, bankId);
          message = result.message;
          reasonCode = result.reasonCode;
        } else if (bankId.state === "failed") {
          verification.status = "FAILED";
          verification.reasonCode = bankId.hintCode;
          await verification.save();
          reasonCode = bankId.hintCode;
          message =
            HINT_MESSAGES[bankId.hintCode] ??
            "Signeringen kunde inte slutföras. Försök igen.";
        }
      }
    }

    let voteCounts = null;
    if (verification.status === "VERIFIED") {
      const counts = await QuestionVote.aggregate([
        { $match: { questionId: verification.questionId } },
        { $group: { _id: "$choice", count: { $sum: 1 } } },
      ]);
      voteCounts = {
        ja: counts.find((c) => c._id === "ja")?.count ?? 0,
        nej: counts.find((c) => c._id === "nej")?.count ?? 0,
      };
    }

    return res.status(200).json({
      questionId: verification.questionId.toString(),
      status: verification.status,
      reasonCode,
      message,
      voteCounts,
      userVote: verification.status === "VERIFIED" ? verification.choice : null,
    });
  } catch (error) {
    log.error("Failed to resolve web verification", { error: error.message });
    // The page polls this; a transient GrandID hiccup should leave it waiting
    // rather than showing a failure the voter cannot act on.
    return res.status(200).json({
      status: "PENDING",
      reasonCode: null,
      message: "",
      voteCounts: null,
      userVote: null,
    });
  }
}
