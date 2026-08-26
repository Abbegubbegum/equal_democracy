/**
 * The pre-election voting-rights quota.
 *
 * Every user may cast at most five **first-time** votes before the election on
 * 2026-09-13. Changing a vote already cast is always free and consumes no slot.
 *
 * This lives in one place because the limit is enforced on five different code
 * paths — the two verification start endpoints, the settle step that actually
 * writes the vote, the legacy mobile endpoint, and the two list endpoints that
 * report it to the UI. Six copies of a number that must agree is how they stop
 * agreeing.
 *
 * **Known undercount.** The tally is a `userId` predicate, and closing a
 * question anonymises its votes by unsetting exactly that field — so votes on
 * closed questions stop counting toward the quota. Accepted deliberately; see
 * docs/bankid-go-live-checklist.md §6.
 */

import { QuestionVote } from "./models";

export const PRE_ELECTION_LIMIT = 5;

export const QUOTA_MESSAGE =
  "Du har röstat i 5 frågor — det är din kvot fram till valet den 13 september.";

export interface QuotaState {
  used: number;
  limit: number;
}

/** What the list endpoints report so the UI can show "X av Y". */
export async function quotaState(userId: string): Promise<QuotaState> {
  return {
    used: await QuestionVote.countDocuments({ userId }),
    limit: PRE_ELECTION_LIMIT,
  };
}

/**
 * Whether this user may still cast a vote on this question.
 *
 * Allowed when they already have a vote on it — changing a choice is free — or
 * when they are under the limit.
 */
export async function canVote(
  userId: string,
  questionId: string,
): Promise<boolean> {
  const existing = await QuestionVote.exists({ questionId, userId });
  if (existing) return true;
  return (await QuestionVote.countDocuments({ userId })) < PRE_ELECTION_LIMIT;
}
