import type { BaseDocument } from "./base.js";

export type ProposalStatus = "active" | "top3" | "archived";
export type CommentType = "for" | "against" | "neutral";
export type FinalVoteChoice = "yes" | "no";

export interface Proposal extends BaseDocument {
  sessionId: string;
  title: string;
  problem: string;
  solution: string;
  authorId: string;
  authorName: string;
  status: ProposalStatus;
  thumbsUpCount: number;
  averageRating: number;
}

export interface ThumbsUp extends BaseDocument {
  sessionId: string;
  proposalId: string;
  userId: string;
  rating: number;
}

export interface Comment extends BaseDocument {
  sessionId: string;
  proposalId: string;
  userId: string;
  authorName: string;
  text: string;
  type: CommentType;
  averageRating: number;
}

export interface CommentRating extends BaseDocument {
  sessionId: string;
  commentId: string;
  userId: string;
  rating: number;
}

export interface FinalVote extends BaseDocument {
  sessionId: string;
  proposalId: string;
  userId: string;
  choice: FinalVoteChoice;
}
