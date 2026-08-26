/**
 * Turning a closed question's votes into anonymous records.
 *
 * While a question is open a vote has to carry identity: to change it, to count
 * a quota, to find it for erasure, and to stop one person voting twice from two
 * accounts. None of that can happen once the question closes — so the identity
 * has a natural expiry, and this is where it expires.
 *
 * After this runs, a vote is `{ questionId, choice, verifiedAt, signatureHash }`.
 * No key anywhere reconstructs who cast it, which makes it anonymous data rather
 * than pseudonymous, and puts it outside the GDPR (Recital 26). The tally is
 * then permanent: nothing a user does later can retroactively change a published
 * result.
 *
 * See docs/gdpr-data-retention.md §5.
 */

import { Question, QuestionVote, VoteVerification } from "./models";
import { createLogger } from "./logger";

const log = createLogger("VoteAnonymisation");

export interface AnonymisationResult {
  votesAnonymised: number;
  verificationsDeleted: number;
}

/**
 * Strips identity from every vote on a closed question.
 *
 * Idempotent — `$unset` on an already-unset field is a no-op, so a re-run
 * costs nothing and cannot corrupt anything.
 *
 * Refuses to touch an active question. Anonymising early would break voting in
 * a way that is hard to notice: the unique indexes are partial, so votes whose
 * `userId` had been removed would silently stop blocking duplicates.
 */
export async function anonymiseQuestionVotes(
  questionId: string,
): Promise<AnonymisationResult> {
  const question: any = await Question.findById(questionId)
    .select("status")
    .lean();

  if (!question) {
    throw new Error(
      `Cannot anonymise votes: question ${questionId} not found.`,
    );
  }
  if (question.status === "active") {
    throw new Error(
      `Refusing to anonymise votes on question ${questionId}: it is still active. ` +
        "Close it first — anonymising early would disable the duplicate-vote protection.",
    );
  }

  const votes = await QuestionVote.updateMany(
    { questionId },
    { $unset: { userId: "", pnrHash: "" } },
  );

  // Without this the anonymisation is cosmetic. A VoteVerification row holds
  // userId, questionId and choice together, so for as long as one survives it
  // reconstructs exactly the link the step above just removed. They are
  // TTL-purged after 30 days anyway; closing the question simply brings that
  // forward, and nothing that has to outlive it lives here — the signature hash
  // is copied onto the vote itself.
  const verifications = await VoteVerification.deleteMany({ questionId });

  const result: AnonymisationResult = {
    votesAnonymised: votes.modifiedCount ?? 0,
    verificationsDeleted: verifications.deletedCount ?? 0,
  };

  log.info("Anonymised votes for closed question", {
    questionId,
    ...result,
  });

  return result;
}
