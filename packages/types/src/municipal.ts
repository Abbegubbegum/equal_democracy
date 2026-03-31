import type { BaseDocument } from "./base.js";

export type MunicipalSessionStatus = "draft" | "active" | "closed" | "archived";
export type MunicipalItemStatus = "draft" | "active" | "closed";
export type CitizenProposalStatus =
  | "active"
  | "selected"
  | "submitted_as_motion"
  | "rejected"
  | "archived";

export interface MunicipalItemArgument {
  text: string;
  type: "for" | "against";
}

export interface MunicipalItem {
  _id?: string;
  originalNumber?: string;
  title?: string;
  description?: string;
  categories?: number[];
  proposalId?: string;
  sessionId?: string;
  initialArguments?: MunicipalItemArgument[];
  status: MunicipalItemStatus;
  closedAt?: string;
  closedBy?: string;
}

export interface MunicipalSession extends BaseDocument {
  name: string;
  municipality: string;
  meetingDate: string;
  meetingTime?: string;
  meetingType: string;
  sourceUrl?: string;
  status: MunicipalSessionStatus;
  createdBy: string;
  items: MunicipalItem[];
  notificationsSent: boolean;
}

export interface CitizenProposal extends BaseDocument {
  title: string;
  description: string;
  categories: number[];
  authorId: string;
  authorName: string;
  status: CitizenProposalStatus;
  totalStars: number;
  ratingCount: number;
  averageRating: number;
  selectedForMunicipalSession?: string;
  selectedAt?: string;
  submittedAsMotionAt?: string;
  motionNumber?: string;
}

export interface CitizenProposalRating extends BaseDocument {
  proposalId: string;
  userId: string;
  rating: number;
}
