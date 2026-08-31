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
import { Question, QuestionVote, User } from "../models";
import { createLogger } from "../logger";
import { allowAnyKommun, runtimeEnv } from "./config";
import { checkEligibilityFromAttributes } from "./eligibility";
import { votePseudonym } from "./pseudonym";
import { loginSubject } from "./subject";
import { QUOTA_MESSAGE, canVote } from "../vote-quota";
import { EXPECTED_ORDER_TYPE, type BankIdSession } from "./session";

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

  // A verification started by a development server must never be completed by
  // the deployment. Both share the production GrandID host, and `pnpm
  // dev:web:live` shares the production database too, so this label is the only
  // thing separating them.
  const runtime = runtimeEnv();
  if (verification.runtime !== runtime) {
    log.error("Verification was created by a different runtime", {
      verificationId,
      verificationRuntime: verification.runtime,
      currentRuntime: runtime,
    });
    return reject("FAILED", "RUNTIME_MISMATCH", SYSTEM_MESSAGE);
  }

  // Whether BankID signed or merely identified follows from the service key, not
  // from what we asked for — so it is read, never assumed. An Identification
  // here means GRANDID_SIGN_SERVICE_KEY points at the authentication service —
  // the one login uses — and every vote would be unbound to its ballot while
  // looking perfectly healthy.
  if (session.evidence.orderType !== EXPECTED_ORDER_TYPE.sign) {
    log.error("BankID did not sign — refusing to record the vote", {
      verificationId,
      orderType: session.evidence.orderType,
      hint: "GRANDID_SIGN_SERVICE_KEY is probably the authentication service, not the signing one",
    });
    return reject("FAILED", "NOT_SIGNED", SYSTEM_MESSAGE);
  }

  // **The person signing must be the person voting.**
  //
  // Nothing checked this before BankID login existed: the account was trusted,
  // and the signature only had to be valid. So A could sign a ballot cast from
  // B's account — with B's history, B's quota and B's name on the vote — and
  // every check downstream would pass, because the signature really was genuine.
  // The per-question pnrHash caught it only if A had already voted on that same
  // question themselves.
  //
  // Now that an account carries its own BankID identity, this is one comparison.
  const voter: any = await User.findById(verification.userId)
    .select("bankidSubject")
    .lean();
  if (!voter) {
    return reject("FAILED", "USER_GONE", SYSTEM_MESSAGE);
  }
  if (!voter.bankidSubject) {
    // The account has no BankID identity to compare against. Unreachable
    // through the app — requireParticipant refuses such an account long before
    // a signature is paid for — so it means something has been bypassed.
    log.error("A vote was signed for an account with no BankID identity", {
      verificationId,
      userId: verification.userId.toString(),
    });
    return reject("FAILED", "NO_ACCOUNT_SUBJECT", SYSTEM_MESSAGE);
  }
  try {
    if (loginSubject(session.personalNumber) !== voter.bankidSubject) {
      log.error("The signing identity does not match the voting account", {
        verificationId,
        userId: verification.userId.toString(),
      });
      return reject(
        "REJECTED",
        "SUBJECT_MISMATCH",
        "Du kan bara rösta med det BankID som kontot är kopplat till.",
      );
    }
  } catch (error) {
    log.error("Could not derive the account subject at settle", {
      verificationId,
      error: error.message,
    });
    return reject("FAILED", "SUBJECT_FAILED", SYSTEM_MESSAGE);
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

  // Re-checked here and not only at start: start is what saves the voter a
  // wasted signature, but this is where the vote is written, so this is the
  // check that actually holds. A signature takes minutes, during which another
  // device could have used the last slot.
  if (
    !(await canVote(
      verification.userId.toString(),
      verification.questionId.toString(),
    ))
  ) {
    return reject("REJECTED", "QUOTA_REACHED", QUOTA_MESSAGE);
  }

  // Development only, and impossible to enable on a deployment — see
  // allowAnyKommun(). Logged at warn every time, because a vote that skipped the
  // residency check must never be silent in the record.
  const bypassKommun = allowAnyKommun();
  if (bypassKommun) {
    log.warn("Residency check bypassed by BANKID_ALLOW_ANY_KOMMUN", {
      verificationId,
    });
  }

  const eligibility = checkEligibilityFromAttributes(session.userAttributes, {
    allowAnyKommun: bypassKommun,
  });

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
      {
        questionId: verification.questionId,
        userId: verification.userId,
      },
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
