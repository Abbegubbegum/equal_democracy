import type { BaseDocument } from "./base.js";

export type SessionType = "standard" | "survey" | "municipal";
export type SessionStatus = "active" | "closed" | "archived";
export type SessionPhase = "phase1" | "phase2" | "closed";

export interface Session extends BaseDocument {
  place: string;
  sessionType: SessionType;
  status: SessionStatus;
  phase: SessionPhase;
  activeUsers: string[];
  phase1TransitionScheduled?: string;
  phase2TerminationScheduled?: string;
  startDate: string;
  phase2StartTime?: string;
  endDate?: string;
  archiveDate?: string;
  surveyDurationDays: number;
  createdBy?: string;
  maxOneProposalPerUser: boolean;
  showUserCount: boolean;
  noMotivation: boolean;
  singleResult: boolean;
  onlyYesVotes: boolean;
  tiebreakerActive: boolean;
  tiebreakerProposals: string[];
  tiebreakerScheduled?: string;
  customTopCount?: number | null;
}

export interface TopProposal extends BaseDocument {
  sessionId: string;
  sessionPlace: string;
  sessionStartDate: string;
  proposalId: string;
  title: string;
  problem: string;
  solution: string;
  authorName: string;
  yesVotes: number;
  noVotes: number;
  archivedAt: string;
}

export interface SessionRequest extends BaseDocument {
  userId: string;
  requestedSessions: number;
  status: "pending" | "approved" | "denied";
  processedAt?: string;
  processedBy?: string;
}

export type AppLanguage = "sv" | "en" | "sr" | "es" | "de";
export type AppTheme = "default" | "green" | "red" | "blue";

export interface Settings extends BaseDocument {
  language: AppLanguage;
  theme: AppTheme;
  sessionLimitHours: number;
  updatedAt: string;
}
