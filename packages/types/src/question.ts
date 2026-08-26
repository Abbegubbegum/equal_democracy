import type { BaseDocument } from "./base.js";

export type QuestionStatus = "active" | "closed";
export type QuestionVoteChoice = "ja" | "nej";
export type QuestionCommentType = "for" | "against" | "neutral";

export interface Question extends BaseDocument {
  text: string;
  status: QuestionStatus;
  deadline: string;
  imageUrl?: string | null;
  categories: string[];
  createdBy?: string;
  /** Set only for questions spawned from a MunicipalMeeting agenda item */
  meetingId?: string;
  closedAt?: string;
}

export interface QuestionVote extends BaseDocument {
  questionId: string;
  choice: QuestionVoteChoice;
  /**
   * Absent once the question closes — votes are anonymised at close, so a
   * closed question's votes have no owner. See docs/gdpr-data-retention.md §5.
   */
  userId?: string;
  /** Set when the vote was backed by a BankID signature; null on older votes. */
  verifiedAt?: string | null;
  /** Per-question voter pseudonym. Never leaves the server; unset at close. */
  pnrHash?: string;
  /** sha256 of the BankID signature. Survives anonymisation. */
  signatureHash?: string;
}

export type VerificationStatus =
  "PENDING" | "VERIFIED" | "REJECTED" | "FAILED" | "CANCELLED";

/**
 * One BankID signing attempt for one ballot. Transient — rows are purged 30
 * days after creation, and anything that must outlive that lives on the vote.
 */
export interface VoteVerification extends BaseDocument {
  userId: string;
  questionId: string;
  choice: QuestionVoteChoice;
  grandIdSession: string;
  redirectUrl: string;
  status: VerificationStatus;
  /** EligibilityCode or BankID hintCode. Never a personal detail. */
  reasonCode?: string | null;
  voteId?: string | null;
  /** Which runtime created the row — not which GrandID host it used. */
  runtime: "development" | "production";
  lastPolledAt?: string | null;
}

export interface QuestionComment extends BaseDocument {
  questionId: string;
  userId: string;
  text: string;
  type: QuestionCommentType;
}

export interface QuestionCommentRating extends BaseDocument {
  commentId: string;
  userId: string;
  rating: number;
}
