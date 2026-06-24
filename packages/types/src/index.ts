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
  UserType,
  NotificationPreference,
  User,
  AuthUser,
} from "./user";

export type {
  SessionType,
  SessionStatus,
  SessionPhase,
  Session,
  TopProposal,
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
  ThumbsUp,
  Comment,
  CommentRating,
  FinalVote,
} from "./proposal";

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
  MunicipalSessionStatus,
  MunicipalItemStatus,
  CitizenProposalStatus,
  MunicipalItemArgument,
  MunicipalItem,
  MunicipalSession,
  CitizenProposal,
  CitizenProposalRating,
  MunicipalItemRating,
} from "./municipal";

export type { SurveyStatus, SurveyChoice, Survey, SurveyVote } from "./survey";
