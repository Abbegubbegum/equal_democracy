import type { BaseDocument } from "./base.js";

export type AdminStatus = "none" | "pending" | "approved" | "denied";
export type NotificationPreference = "email" | "sms" | "both" | "none";
export type MembershipStatus = "none" | "active";

/** Which credential may open a session. "bankid" is terminal — see Capability. */
export type AuthMethod = "email" | "bankid";

/**
 * What a viewer is allowed to do. Replaces "is there a session?" across both
 * surfaces — see apps/web/lib/viewer.ts and docs/bankid-login-plan.md §3.
 *
 * `restricted` means one thing: BankID-verified but not eligible to vote in
 * Vallentuna. It is a durable state — the user browses in it and may never leave
 * it — so it carries the wording explaining why.
 *
 * `needs_bankid` is a legacy email account that has not linked BankID. Transient
 * and never browsed in: the link gate blocks the account at startup and offers
 * only "link BankID" or "log out". It exists as a state because the server
 * cannot assume a client ran that gate.
 */
export type Capability =
  "anonymous" | "needs_bankid" | "restricted" | "participant";

/** The cached folkbokföring verdict from the user's last BankID login. */
export interface EligibilityState {
  eligible: boolean;
  /** An EligibilityCode from apps/web/lib/bankid/eligibility.ts. */
  code: string | null;
  checkedAt?: string | null;
}

export interface User extends BaseDocument {
  name: string;
  /**
   * A contact channel, not a credential — optional, unverified, and removable
   * by the user like `phoneNumber`. Absent on a BankID account until they add
   * one.
   */
  email?: string | null;
  authMethod: AuthMethod;
  /** Set once BankID is linked; its presence is what ends email login. */
  bankidSubject?: string | null;
  bankidLinkedAt?: string | null;
  eligibility?: EligibilityState;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminStatus: AdminStatus;
  sessionLimit: number;
  remainingSessions: number;
  appliedForAdminAt?: string;
  organization?: string;
  requestedSessions?: number;
  interests: string[];
  expoPushToken?: string;
  notificationPreference: NotificationPreference;
  phoneNumber?: string;
  emailOptOut: boolean;
  membershipStatus: MembershipStatus;
  /** End of the last calendar year this member has paid for. */
  membershipPaidUntil?: string | null;
  membershipFirstPaidAt?: string | null;
}

/** Subset of User returned in session context (auth token) */
export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}
