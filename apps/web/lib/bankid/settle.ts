/**
 * Applying a completed BankID signature to a verification, and writing the vote.
 *
 * This is the **only** place a verified vote is created. The client never gets
 * to say "I verified" — it starts a verification, the ballot is recorded then,
 * and the vote appears here or not at all. That is what stops a choice being
 * swapped after BankID displayed a different one.
 *
 * Transitions are one-way out of PENDING, so a replayed poll, a double-tap or
 * two lambdas racing the same session all converge on the same outcome.
 */

import crypto from "crypto";
import { Question, QuestionVote } from "../models";
import { createLogger } from "../logger";
import { getGrandIdConfig } from "./config";
import { checkEligibilityFromAttributes } from "./eligibility";
import { votePseudonym } from "./pseudonym";
import type { BankIdSession } from "./session";

const log = createLogger("BankIdSettle");

export interface SettleResult {
  /** True when this call moved the verification out of PENDING. */
  changed: boolean;
  status: string;
  /** EligibilityCode, or one of the codes below. Null when verified. */
  reasonCode: string | null;
  /** Swedish, safe to show the voter. */
  message: string;
  voteId: string | null;
}

/** Reasons that are ours rather than the voter's. */
const SYSTEM_MESSAGE =
  "Något gick fel när rösten skulle registreras. Försök igen om en stund.";

function settled(
  verification: any,
  status: string,
  reasonCode: string | null,
  message: string,
): SettleResult {
  return {
    changed: true,
    status,
    reasonCode,
    message,
    voteId: verification.voteId ? verification.voteId.toString() : null,
  };
}

/**
 * Applies an authoritative completed session to a verification row.
 *
 * `verification` is a live Mongoose document and is saved here when it changes.
 * `session` must be the `complete` variant — callers check that first, because
 * pending and failed sessions are not settlement events.
 */
export async function settleVerification(
  verification: any,
  session: Extract<BankIdSession, { state: "complete" }>,
): Promise<SettleResult> {
  const verificationId = verification._id.toString();

  if (verification.status !== "PENDING") {
    return {
      changed: false,
      status: verification.status,
      reasonCode: verification.reasonCode ?? null,
      message: "",
      voteId: verification.voteId ? verification.voteId.toString() : null,
    };
  }

  const reject = async (
    status: string,
    reasonCode: string,
    message: string,
  ): Promise<SettleResult> => {
    verification.status = status;
    verification.reasonCode = reasonCode;
    await verification.save();
    log.info("Verification settled without a vote", {
      verificationId,
      status,
      reasonCode,
    });
    return settled(verification, status, reasonCode, message);
  };

  // A verification created against the test service must never be able to write
  // a real vote, the same guard Payment.env gives membership.
  const { env } = getGrandIdConfig();
  if (verification.env !== env) {
    log.error("Verification environment does not match the runtime", {
      verificationId,
      verificationEnv: verification.env,
      runtimeEnv: env,
    });
    return reject("FAILED", "ENV_MISMATCH", SYSTEM_MESSAGE);
  }

  // Whether BankID signed or merely identified follows from the service key, not
  // from what we asked for — so it is read, never assumed. An Identification
  // here means GRANDID_SERVICE_KEY points at the authentication service, and
  // every vote would be unbound to its ballot while looking perfectly healthy.
  if (session.evidence.orderType !== "Signing") {
    log.error("BankID did not sign — refusing to record the vote", {
      verificationId,
      orderType: session.evidence.orderType,
      hint: "GRANDID_SERVICE_KEY is probably the authentication service, not the signing one",
    });
    return reject("FAILED", "NOT_SIGNED", SYSTEM_MESSAGE);
  }

  // The question can close while the voter is signing. Writing the vote anyway
  // would be worse than losing it: its votes have just been anonymised, so an
  // arriving row still carrying userId would be the only identifiable one in
  // the set — singling out exactly the person anonymisation protects.
  const question: any = await Question.findById(verification.questionId)
    .select("status")
    .lean();
  if (!question || question.status !== "active") {
    return reject(
      "REJECTED",
      "QUESTION_CLOSED",
      "Frågan stängdes innan din signering hann bli klar. Din röst registrerades därför inte.",
    );
  }

  const eligibility = checkEligibilityFromAttributes(session.userAttributes);

  if (eligibility.code === "SPAR_MISSING") {
    // Not a verdict about the voter — the SPAR add-on stopped arriving, which
    // is a configuration failure on our side and needs to be noisy.
    log.error("No SPAR data in a completed BankID session", {
      verificationId,
      attributeKeys: Object.keys(session.userAttributes || {}).join(","),
    });
    return reject("FAILED", "SPAR_MISSING", eligibility.message);
  }

  if (!eligibility.eligible) {
    return reject("REJECTED", eligibility.code, eligibility.message);
  }

  const questionId = verification.questionId.toString();
  let pnrHash: string;
  try {
    pnrHash = votePseudonym(session.personalNumber, questionId);
  } catch (error) {
    // Missing pepper, or a personal number in an unexpected shape. Either way
    // the duplicate protection would be absent rather than merely broken.
    log.error("Could not derive the voter pseudonym", {
      verificationId,
      error: error.message,
    });
    return reject("FAILED", "PSEUDONYM_FAILED", SYSTEM_MESSAGE);
  }

  const signatureHash = session.evidence.signature
    ? crypto
        .createHash("sha256")
        .update(session.evidence.signature)
        .digest("hex")
    : null;

  let vote: any;
  try {
    vote = await QuestionVote.findOneAndUpdate(
      { questionId: verification.questionId, userId: verification.userId },
      {
        choice: verification.choice,
        verifiedAt: new Date(),
        pnrHash,
        signatureHash,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    // The unique index on {questionId, pnrHash} fired: this person already has
    // a vote on this question from another account. An expected outcome, not a
    // server fault.
    if (error.code === 11000) {
      return reject(
        "REJECTED",
        "ALREADY_VOTED",
        "Du har redan röstat i den här frågan. Varje person får rösta en gång, även med flera konton.",
      );
    }
    log.error("Failed to write the verified vote", {
      verificationId,
      error: error.message,
    });
    return reject("FAILED", "VOTE_WRITE_FAILED", SYSTEM_MESSAGE);
  }

  verification.status = "VERIFIED";
  verification.reasonCode = null;
  verification.voteId = vote._id;
  verification.evidence = {
    orderType: session.evidence.orderType,
    // The signature itself is never stored: its XML embeds the signer's
    // certificate, so keeping it would mean keeping a personnummer and a name.
    signatureHash,
    bankIdIssueDate: session.evidence.bankIdIssueDate,
    notBefore: session.evidence.notBefore,
    notAfter: session.evidence.notAfter,
  };
  await verification.save();

  log.info("Vote verified and recorded", {
    verificationId,
    questionId,
    voteId: vote._id.toString(),
  });

  return {
    changed: true,
    status: "VERIFIED",
    reasonCode: null,
    message: "Din röst är registrerad och signerad med BankID.",
    voteId: vote._id.toString(),
  };
}
