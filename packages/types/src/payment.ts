import type { BaseDocument } from "./base.js";

/** Swish Commerce API payment statuses. CREATED is the only non-terminal one. */
export type PaymentStatus =
  "CREATED" | "PAID" | "DECLINED" | "ERROR" | "CANCELLED";

/** Which Swish environment a payment was made against. */
export type PaymentEnv = "mss" | "production";

export type PaymentPurpose = "membership";

export interface Payment extends BaseDocument {
  userId: string;
  /**
   * The instructionUUID we sent to Swish: 32 uppercase hex chars, no dashes.
   * Doubles as the id in Swish's own GET/PATCH endpoints.
   */
  instructionId: string;
  /**
   * Shared secret echoed back by Swish as a header on the callback. The callback
   * is otherwise unauthenticated, so this is what proves it belongs to us.
   */
  callbackIdentifier: string;
  /** PaymentRequestToken from Swish — what the app-switch URL carries. */
  token?: string | null;
  /** Bank's reference for the completed payment. Only present once PAID. */
  paymentReference?: string | null;
  amount: number;
  currency: string;
  message?: string;
  status: PaymentStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** The payer's phone number, returned by Swish once they sign. */
  payerAlias?: string | null;
  purpose: PaymentPurpose;
  /** Calendar years this payment covers, e.g. [2026, 2027]. */
  membershipYears: number[];
  /**
   * Guards against sandbox rows ever counting as real money — an mss payment
   * must never grant membership in production.
   */
  env: PaymentEnv;
  datePaid?: string | null;
  /** Last time we asked Swish for this payment's state (poll throttle). */
  lastPolledAt?: string | null;
}

/**
 * Membership pricing (Fas 0, pre-election). Hardcoded constants in the same
 * spirit as PRE_ELECTION_LIMIT / CITIZEN_PROPOSAL_LIMIT — nothing needs to
 * change these before the 2026-09-13 election.
 */
export const MEMBERSHIP_FEE_SEK = 250;

/** Founding-member deal: one payment covers both years. */
export const MEMBERSHIP_YEARS: number[] = [2026, 2027];

/**
 * Text on the payer's Swish receipt. Swish allows max 50 chars from a-öA-Ö0-9
 * plus `:;.,?!()"` — so the å in "Framåt" is legal, but it is the one character
 * here worth re-checking against MSS if a create ever fails with RP02.
 */
export const MEMBERSHIP_PAYMENT_MESSAGE = "Medlemsavgift Vallentuna Framåt";
