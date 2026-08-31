/**
 * The account identity behind a BankID login — without storing who anyone is.
 *
 * A returning user has to land on the account they left, so this pseudonym is
 * **globally stable**, unlike `votePseudonym` in ./pseudonym.ts which is salted
 * per question precisely so it is not. The two exist for opposite reasons and
 * must never be confused:
 *
 *     votePseudonym   HMAC(VOTE_ID_PEPPER,  pnr + ":" + questionId)
 *     loginSubject    HMAC(LOGIN_ID_PEPPER, "login:" + pnr)
 *
 * Two separate peppers plus a domain prefix, so a value from one can never
 * collide with or be mistaken for the other. Sharing a pepper would not be
 * catastrophic — anyone holding it can brute-force a personnummer out of either
 * hash in seconds, ~10^10 candidates — but it would mean one leaked secret
 * links every account to its whole voting record at once. Separating them keeps
 * that blast radius to one half.
 *
 * Consequences worth being explicit about, because this is the first globally
 * stable identifier in the schema:
 *
 * - A unique index on `User.bankidSubject` is what makes one person = one
 *   account structurally true, which is in turn what makes the pre-election
 *   quota mean anything.
 * - It **cannot be rotated**. Rotating VOTE_ID_PEPPER silently resets duplicate
 *   protection; rotating this one orphans every account on the platform. Treat
 *   it exactly like NEXTAUTH_SECRET and set it once.
 * - Holding the database and this pepper is enough to identify every user. That
 *   is inherent to BankID login rather than a flaw in this design — but it is
 *   why the pepper is production-scope only and never in the repo.
 */

import crypto from "crypto";

function pepper(): string {
  const value = process.env.LOGIN_ID_PEPPER;
  if (!value || value.length < 32) {
    // Fail closed. A login that proceeded without this would either create a
    // duplicate account for someone who already has one, or — far worse if a
    // fallback ever computed a weak value — collapse two people onto one
    // account. Neither is recoverable after the fact.
    throw new Error(
      "LOGIN_ID_PEPPER is not set (or is shorter than 32 characters). It salts the " +
        "BankID account identity, and without it a returning user cannot be matched " +
        "to their existing account. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return value;
}

/**
 * Stable account identity for one person.
 *
 * `personalNumber` is whatever BankID returned (12 digits); anything else is
 * rejected rather than hashed, because a silently different normalisation would
 * produce a different subject and hand the same human a second account.
 */
export function loginSubject(personalNumber: string): string {
  const digits = String(personalNumber || "").replace(/\D/g, "");
  if (digits.length !== 12) {
    throw new Error(
      `Expected a 12-digit personal number from BankID, got ${digits.length} digits.`,
    );
  }

  return crypto
    .createHmac("sha256", pepper())
    .update(`login:${digits}`)
    .digest("hex");
}
