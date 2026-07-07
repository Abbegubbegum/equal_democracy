import type { BaseDocument } from "./base.js";

export type ProposalStatus = "active" | "finalist" | "archived";
export type CommentType = "for" | "against" | "neutral";
export type FinalVoteChoice = "yes" | "no";

export interface Proposal extends BaseDocument {
  sessionId: string;
  title: string;
  problem: string;
  solution: string;
  authorId: string;
  status: ProposalStatus;
  categories?: string[];
  imageUrl?: string | null;
}

export interface ProposalRating extends BaseDocument {
  proposalId: string;
  userId: string;
  rating: number;
}

export interface Comment extends BaseDocument {
  proposalId: string;
  userId: string;
  text: string;
  type: CommentType;
}

export interface CommentRating extends BaseDocument {
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
