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
  userId: string;
  choice: QuestionVoteChoice;
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
