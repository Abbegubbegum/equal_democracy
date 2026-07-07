import type { BaseDocument } from "./base.js";

export type SessionStatus = "active" | "closed";
export type SessionPhase = "phase1" | "phase2" | "closed";

export interface Session extends BaseDocument {
  title: string;
  status: SessionStatus;
  phase: SessionPhase;
  activeUsers: string[];
  phase1TransitionScheduled?: string;
  phase2TerminationScheduled?: string;
  startDate: string;
  phase2StartTime?: string;
  endDate?: string;
  deadline?: string;
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

export interface WinningProposal extends BaseDocument {
  sessionId: string;
  sessionTitle: string;
  sessionStartDate: string;
  proposalId: string;
  title: string;
  problem: string;
  solution: string;
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
  updatedAt: string;
}
