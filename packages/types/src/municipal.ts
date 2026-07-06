import type { BaseDocument } from "./base.js";

export type MunicipalMeetingStatus = "draft" | "active" | "closed" | "archived";
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
  categories?: string[];
  imageUrl?: string | null;
  /** Question spawned for this item on activation */
  questionId?: string;
  initialArguments?: MunicipalItemArgument[];
  status: MunicipalItemStatus;
  closedAt?: string;
  closedBy?: string;
}

export interface MunicipalMeeting extends BaseDocument {
  name: string;
  municipality: string;
  meetingDate: string;
  meetingTime?: string;
  meetingType: string;
  sourceUrl?: string;
  status: MunicipalMeetingStatus;
  createdBy: string;
  items: MunicipalItem[];
  notificationsSent: boolean;
}

export interface CitizenProposal extends BaseDocument {
  title: string;
  description: string;
  categories: string[];
  authorId: string;
  status: CitizenProposalStatus;
  imageUrl?: string | null;
}

export interface CitizenProposalRating extends BaseDocument {
  proposalId: string;
  userId: string;
  rating: number;
}

export interface MunicipalItemRating extends BaseDocument {
  meetingId: string;
  itemId: string;
  userId: string;
  rating: number;
}
