export type { BaseDocument } from "./base";

export {
  GEOGRAPHIC_CATEGORIES,
  THEMATIC_CATEGORIES,
  ALL_CATEGORIES,
  INTEREST_TO_CATEGORIES,
  INTEREST_AREAS,
} from "./categories";
export type {
  GeographicCategory,
  ThematicCategory,
  ContentCategory,
  InterestArea,
} from "./categories";

export type {
  AdminStatus,
  NotificationPreference,
  User,
  AuthUser,
} from "./user";

export type {
  SessionStatus,
  SessionPhase,
  Session,
  WinningProposal,
  SessionRequest,
  AppLanguage,
  AppTheme,
  Settings,
} from "./session";

export type {
  ProposalStatus,
  CommentType,
  FinalVoteChoice,
  Proposal,
  ProposalRating,
  Comment,
  CommentRating,
  FinalVote,
} from "./proposal";

export type {
  QuestionStatus,
  QuestionVoteChoice,
  QuestionCommentType,
  Question,
  QuestionVote,
  QuestionComment,
  QuestionCommentRating,
} from "./question";

export type {
  BudgetSessionStatus,
  BudgetArgumentDirection,
  BudgetSubcategory,
  BudgetCategory,
  BudgetIncomeCategory,
  BudgetSession,
  BudgetVoteAllocation,
  BudgetVoteIncomeAllocation,
  BudgetVote,
  BudgetMedianAllocation,
  BudgetMedianIncomeAllocation,
  BudgetResult,
  BudgetArgument,
  BudgetCategoryRating,
} from "./budget";

export type {
  MunicipalMeetingStatus,
  MunicipalItemStatus,
  CitizenProposalStatus,
  MunicipalItemArgument,
  MunicipalItem,
  MunicipalMeeting,
  CitizenProposal,
  CitizenProposalRating,
  MunicipalItemRating,
} from "./municipal";
