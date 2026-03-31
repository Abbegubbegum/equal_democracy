import type { BaseDocument } from "./base.js";

export type AdminStatus = "none" | "pending" | "approved" | "denied";
export type UserType = "citizen" | "member" | "none";
export type NotificationPreference = "email" | "sms" | "both" | "none";

export interface User extends BaseDocument {
  name: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminStatus: AdminStatus;
  sessionLimit: number;
  remainingSessions: number;
  appliedForAdminAt?: string;
  organization?: string;
  requestedSessions?: number;
  isMember: boolean;
  userType: UserType;
  bankIdVerified: boolean;
  bankIdPersonalNumber?: string;
  interestedCategories: number[];
  notificationPreference: NotificationPreference;
  phoneNumber?: string;
  lastCitizenVoteDate?: string;
  votesUsedInCurrentYear: number;
  canCloseQuestions: boolean;
  emailOptOut: boolean;
}

/** Subset of User returned in session context (auth token) */
export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  municipality?: string;
}
