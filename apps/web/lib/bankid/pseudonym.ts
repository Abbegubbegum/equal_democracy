/**
 * One person, one vote per question — without storing who they are.
 *
 * A BankID signature proves the voter approved this ballot. It does not stop
 * the same human voting again from a second app account: both signatures are
 * genuine, both votes verify, and nothing links them. That is the gap this
 * closes, and it is the failure mode that matters most for a voting platform
 * because it leaves no trace anyone could audit afterwards.
 *
 * The pseudonym is **salted per question**:
 *
 *     HMAC-SHA256(pepper, personnummer + ":" + questionId)
 *
 * A unique index on `{questionId, pnrHash}` then makes a second vote on the
 * same question impossible regardless of how many accounts the person holds.
 * Salting per question is what keeps that from also building a voting profile:
 * with a single global pepper the same person's hash would be identical on
 * every question, so anyone with database access could trace their whole
 * record. With the question mixed in, two rows from the same human are
 * unlinkable.
 *
 * The pepper is the entire protection. A personnummer has ~10^10 plausible
 * values, so an attacker holding both the hashes and the pepper could brute
 * force every voter's identity in seconds — treat VOTE_ID_PEPPER exactly like
 * NEXTAUTH_SECRET. It also can never be rotated: every existing hash would stop
 * matching and the duplicate protection would silently reset.
 */

import crypto from "crypto";

function pepper(): string {
  const value = process.env.VOTE_ID_PEPPER;
  if (!value || value.length < 32) {
    // Fail closed. Writing votes without this is worse than not writing them:
    // the duplicate protection would be silently absent rather than broken.
    throw new Error(
      "VOTE_ID_PEPPER is not set (or is shorter than 32 characters). It salts the " +
        "per-question voter pseudonym, and without it one person could vote twice " +
        "on the same question from two accounts. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return value;
}

/**
 * Stable pseudonym for one person on one question.
 *
 * `personalNumber` is whatever BankID returned (12 digits); anything else is
 * rejected rather than hashed, because a silently different normalisation would
 * produce a different pseudonym and let a duplicate through.
 */
export function votePseudonym(
  personalNumber: string,
  questionId: string,
): string {
  const digits = String(personalNumber || "").replace(/\D/g, "");
  if (digits.length !== 12) {
    throw new Error(
      `Expected a 12-digit personal number from BankID, got ${digits.length} digits.`,
    );
  }
  if (!questionId) {
    throw new Error("questionId is required — it is the per-question salt.");
  }

  return crypto
    .createHmac("sha256", pepper())
    .update(`${digits}:${questionId}`)
    .digest("hex");
}
