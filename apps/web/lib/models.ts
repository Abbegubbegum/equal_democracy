import mongoose from "mongoose";

// User Model
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      maxlength: [60, "Name cannot be more than 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    adminStatus: {
      type: String,
      enum: ["none", "pending", "approved", "denied"],
      default: "none",
      index: true,
    },
    sessionLimit: {
      type: Number,
      default: 10,
      min: 1,
      max: 50,
    },
    remainingSessions: {
      type: Number,
      default: 10,
      min: 0,
      max: 50,
    },
    appliedForAdminAt: {
      type: Date,
    },
    organization: {
      type: String,
    },
    requestedSessions: {
      type: Number,
      min: 1,
      max: 50,
    },
    interests: {
      type: [String],
      default: [],
    },
    expoPushToken: {
      type: String,
      // Expo push token for mobile push notifications
    },
    // Notification preferences
    notificationPreference: {
      type: String,
      enum: ["email", "sms", "both", "none"],
      default: "email",
    },
    phoneNumber: {
      type: String,
      // For SMS notifications
    },
    // Email opt-out (unsubscribe from non-essential emails)
    emailOptOut: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const LoginCodeSchema = new mongoose.Schema(
  {
    email: { type: String, index: true, required: true, lowercase: true },
    codeHash: { type: String, required: true },
    // Basic throttling
    attempts: { type: Number, default: 0 },
    // Auto-expire after 10 min via TTL index
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Proposal Model
const ProposalSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Please provide a title"],
      maxlength: [200, "Title cannot be more than 200 characters"],
    },
    problem: {
      type: String,
      required: false,
      default: "",
      maxlength: [
        1000,
        "Problem description cannot be more than 1000 characters",
      ],
    },
    solution: {
      type: String,
      required: false,
      default: "",
      maxlength: [
        1000,
        "Solution description cannot be more than 1000 characters",
      ],
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // "finalist" = promoted to the phase-2 yes/no vote.
    // Rating aggregates are computed at read time from ProposalRating —
    // no denormalized counters (they drift out of sync).
    status: {
      type: String,
      enum: ["active", "finalist", "archived"],
      default: "active",
    },
    categories: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// ProposalRating Model — 1-5 star rating on a Proposal
const ProposalRatingSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

ProposalRatingSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Comment Model (supports for/against/neutral). The session is derivable via
// proposalId -> Proposal.sessionId; rating aggregates are computed at read
// time from CommentRating.
const CommentSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Please provide comment text"],
      maxlength: [1000, "Comment cannot be more than 1000 characters"],
    },
    type: {
      type: String,
      enum: ["for", "against", "neutral"],
      default: "neutral",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// CommentRating Model - for rating comments/arguments (similar to ProposalRating)
const CommentRatingSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

CommentRatingSchema.index({ commentId: 1, userId: 1 }, { unique: true });

// FinalVote Model
const FinalVoteSchema = new mongoose.Schema(
  {
    // Deliberately denormalized (also derivable via proposalId): a session
    // has one vote per user across proposals in practice, and this supports
    // the direct "has this user voted in this session?" lookup.
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    choice: {
      type: String,
      enum: ["yes", "no"],
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

FinalVoteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Session Model - a standard 2-phase live democracy session
const SessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      index: true,
    },
    phase: {
      type: String,
      enum: ["phase1", "phase2", "closed"],
      default: "phase1",
      index: true,
    },
    activeUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    phase1TransitionScheduled: {
      type: Date,
    },
    phase2TerminationScheduled: {
      type: Date,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    phase2StartTime: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    // Per-session end-of-life, set at creation (replaces the old global
    // Settings.sessionLimitHours). The daily cron closes active sessions
    // whose deadline has passed; the all-users-voted auto-close can end a
    // session earlier.
    deadline: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    maxOneProposalPerUser: {
      type: Boolean,
      default: false,
    },
    showUserCount: {
      type: Boolean,
      default: false,
    },
    noMotivation: {
      type: Boolean,
      default: false,
    },
    singleResult: {
      type: Boolean,
      default: false,
    },
    onlyYesVotes: {
      type: Boolean,
      default: false,
    },
    // Tiebreaker fields (singleResult sessions)
    tiebreakerActive: {
      type: Boolean,
      default: false,
    },
    tiebreakerProposals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Proposal",
      },
    ],
    tiebreakerScheduled: {
      type: Date,
    },
    // Admin-adjustable top proposal count during phase transition
    customTopCount: {
      type: Number,
      default: null,
    },
    // Cover image URL for mobile app display
    imageUrl: {
      type: String,
      default: null,
    },
    // Content categories for targeted notifications
    categories: {
      type: [String],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// WinningProposal Model - winning proposals from closed sessions (finalists
// with yes-majority). Deliberately an immutable denormalized snapshot
// (session title, proposal title, votes copied at close time) — the archive
// record must not change if live documents are edited or deleted. Author
// names are NOT stored anywhere.
const WinningProposalSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    sessionTitle: {
      type: String,
      required: true,
    },
    sessionStartDate: {
      type: Date,
      required: true,
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    problem: {
      type: String,
      required: false,
      default: "",
    },
    solution: {
      type: String,
      required: false,
      default: "",
    },
    yesVotes: {
      type: Number,
      required: true,
    },
    noVotes: {
      type: Number,
      required: true,
    },
    archivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// MunicipalMeeting Model - a council/board meeting (kommunfullmäktige): agenda
// PDF metadata plus the AI-extracted agenda items. Activating an item spawns a
// Question document (see items[].questionId) that carries the debate + votes.
const MunicipalMeetingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      // e.g. "Kommunfullmäktige_260119"
    },
    municipality: {
      type: String,
      required: true,
      default: "Vallentuna",
      index: true,
      // e.g. "Vallentuna", "Stockholm", etc.
    },
    meetingDate: {
      type: Date,
      required: true,
      index: true,
    },
    meetingTime: {
      type: String,
      // e.g. "18:30" - extracted from PDF or defaulted to "18:00"
    },
    meetingType: {
      type: String,
      required: true,
      default: "Kommunfullmäktige",
      index: true,
      // Could also be "Kommunstyrelsen", "Barn- och ungdomsnämnden", etc.
    },
    sourceUrl: {
      type: String,
      // URL to the original agenda PDF
    },
    status: {
      type: String,
      enum: ["draft", "active", "closed", "archived"],
      default: "draft",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Each item is an issue/question to be voted on
    items: [
      {
        originalNumber: String, // Original § number from agenda
        title: String, // Active title: "Anta den nya Arbetsmiljöpolicyn"
        description: String, // Background/context
        categories: [String], // ALL_CATEGORIES tags (thematic/geographic)
        imageUrl: {
          type: String,
          default: null,
        },
        // Rating aggregates computed at read time from MunicipalItemRating —
        // no denormalized totalStars/ratingCount/averageRating here.
        questionId: {
          // Link to the Question spawned for this item on activation
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
        },
        initialArguments: [
          {
            text: String,
            type: {
              type: String,
              enum: ["for", "against"],
            },
          },
        ],
        status: {
          type: String,
          enum: ["draft", "active", "closed"],
          default: "draft",
        },
        closedAt: Date,
        closedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    notificationsSent: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// CitizenProposal Model - for citizen-initiated proposals (medborgarförslag)
const CitizenProposalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxlength: [200, "Title cannot be more than 200 characters"],
    },
    description: {
      type: String,
      required: true,
      maxlength: [2000, "Description cannot be more than 2000 characters"],
    },
    categories: {
      type: [String],
      default: [],
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      // Förslag lifecycle: active (on the ranked stack, incl. the 10-day grace
      // window) → motion (lifted off the stack as the month's #1, awaiting the
      // manual fullmäktige handoff) → archived (culled from the stack, removed
      // by an admin, or after it became a fullmäktige Question). The legacy
      // "selected"/"submitted_as_motion"/"rejected" values are kept only so old
      // documents still validate; the new flow uses active/motion/archived.
      enum: [
        "active",
        "motion",
        "archived",
        "selected",
        "submitted_as_motion",
        "rejected",
      ],
      default: "active",
      index: true,
    },
    // When this proposal was lifted off the stack as a motion (monthly #1 or a
    // manual admin override). Null while it's still active/archived.
    motionAt: {
      type: Date,
      default: null,
    },
    // Fullmäktige's real-world decision once the motion went to the council.
    // Reported by an elected representative (an admin) on /manage-proposals.
    // Powers the Arkiv "Hem" tab (godkända 👍 / avslagna 👎).
    fullmaktigeOutcome: {
      type: String,
      enum: ["approved", "rejected"],
      default: null,
    },
    fullmaktigeDecisionAt: {
      type: Date,
      default: null,
    },
    // Rating aggregates computed at read time from CitizenProposalRating —
    // no denormalized totalStars/ratingCount/averageRating here. Ranking by
    // score (ratingCount × averageRating³) needs an aggregation, not a .sort().
    imageUrl: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Citizen Proposal Rating Model
const CitizenProposalRatingSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CitizenProposal",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// One rating per user per proposal
CitizenProposalRatingSchema.index(
  { proposalId: 1, userId: 1 },
  { unique: true },
);

// Municipal Item Rating Model — 1-5 star rating on a MunicipalMeeting item
const MunicipalItemRatingSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MunicipalMeeting",
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// One rating per user per municipal item
MunicipalItemRatingSchema.index({ itemId: 1, userId: 1 }, { unique: true });

// Budget Category Rating Model — 1-5 star rating on a BudgetSession category
const BudgetCategoryRatingSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    categoryId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// One rating per user per budget category
BudgetCategoryRatingSchema.index(
  { sessionId: 1, categoryId: 1, userId: 1 },
  { unique: true },
);

// Settings Model - for global settings
const SettingsSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      enum: ["sv", "en", "sr", "es", "de"],
      default: "sv",
    },
    theme: {
      type: String,
      enum: ["default", "green", "red", "blue"],
      default: "default",
    },
    // The swappable rightmost tile on the public start page's quick-nav.
    // Superadmin switches this in the admin Settings panel when an activity
    // starts (e.g. set to "budget" to launch a budget to the public nav).
    featureSlot: {
      type: String,
      enum: ["info", "budget", "arkiv", "livesession"],
      default: "info",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// SessionRequest Model - for existing admins requesting more sessions
const SessionRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedSessions: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// BudgetSession Model - represents a budget voting session
const BudgetSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Please provide a session name"],
      maxlength: [200, "Session name cannot be more than 200 characters"],
    },
    municipality: {
      type: String,
      required: [true, "Please provide a municipality name"],
      maxlength: [100, "Municipality name cannot be more than 100 characters"],
    },
    totalBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["draft", "active", "closed"],
      default: "draft",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    // Tax base for calculating tax income (e.g., population × 1000 kr)
    // For 2025 Vallentuna: 19 kr = 2135.3 mnkr, so taxBase = 112,384,210
    taxBase: {
      type: Number,
      min: 0,
    },
    defaultTaxRateKr: {
      type: Number,
      default: 19,
    },
    minTaxRateKr: {
      type: Number,
      default: 18,
    },
    maxTaxRateKr: {
      type: Number,
      default: 21,
    },
    // Expense categories (nämnder)
    categories: [
      {
        id: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        defaultAmount: {
          type: Number,
          required: true,
          min: 0,
        },
        minAmount: {
          type: Number,
          required: true,
          min: 0,
        },
        isFixed: {
          type: Boolean,
          default: false,
        },
        color: {
          type: String,
          default: "#4a90e2",
        },
        tags: {
          type: [String],
          default: [],
        },
        imageUrl: {
          type: String,
          default: null,
        },
        totalStars: {
          type: Number,
          default: 0,
        },
        ratingCount: {
          type: Number,
          default: 0,
        },
        averageRating: {
          type: Number,
          default: 0,
          min: 0,
          max: 5,
        },
        subcategories: [
          {
            id: {
              type: String,
              required: true,
            },
            name: {
              type: String,
              required: true,
            },
            defaultAmount: {
              type: Number,
              required: true,
              min: 0,
            },
            minAmount: {
              type: Number,
              required: true,
              min: 0,
            },
            isFixed: {
              type: Boolean,
              default: false,
            },
          },
        ],
      },
    ],
    // Income categories (intäkter)
    incomeCategories: [
      {
        id: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        color: {
          type: String,
          default: "#6b7280",
        },
        // For tax rate (kommunalskatt)
        isTaxRate: {
          type: Boolean,
          default: false,
        },
        taxRatePercent: {
          type: Number,
          min: 0,
          max: 100,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// BudgetVote Model - individual participant's budget proposal
const BudgetVoteSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Expense allocations
    allocations: [
      {
        categoryId: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        subcategories: [
          {
            subcategoryId: {
              type: String,
              required: true,
            },
            amount: {
              type: Number,
              required: true,
              min: 0,
            },
          },
        ],
      },
    ],
    // Income allocations
    incomeAllocations: [
      {
        categoryId: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        // For tax rate
        taxRatePercent: {
          type: Number,
          min: 0,
          max: 100,
        },
      },
    ],
    totalExpenses: {
      type: Number,
      required: true,
      min: 0,
    },
    totalIncome: {
      type: Number,
      required: true,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure one vote per user per session
BudgetVoteSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

// BudgetResult Model - calculated median budget
const BudgetResultSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Median expense allocations
    medianAllocations: [
      {
        categoryId: {
          type: String,
          required: true,
        },
        medianAmount: {
          type: Number,
          required: true,
          min: 0,
        },
        percentageOfTotal: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        subcategories: [
          {
            subcategoryId: {
              type: String,
              required: true,
            },
            medianAmount: {
              type: Number,
              required: true,
              min: 0,
            },
            percentageOfCategory: {
              type: Number,
              required: true,
              min: 0,
              max: 100,
            },
          },
        ],
      },
    ],
    // Median income allocations
    medianIncomeAllocations: [
      {
        categoryId: {
          type: String,
          required: true,
        },
        medianAmount: {
          type: Number,
          required: true,
          min: 0,
        },
        // For tax rate
        medianTaxRatePercent: {
          type: Number,
          min: 0,
          max: 100,
        },
      },
    ],
    totalMedianExpenses: {
      type: Number,
      required: true,
      min: 0,
    },
    totalMedianIncome: {
      type: Number,
      required: true,
      min: 0,
    },
    // After balancing expenses to match income
    balancedExpenses: {
      type: Number,
      required: true,
      min: 0,
    },
    voterCount: {
      type: Number,
      required: true,
      min: 0,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

type AnyModel = mongoose.Model<any>;

function safeModel(name: string, schema: mongoose.Schema): AnyModel {
  return ((mongoose.models[name] as AnyModel | undefined) ??
    mongoose.model(name, schema)) as AnyModel;
}

// Export models
if (mongoose.models["User"]) delete mongoose.models["User"];
export const User: AnyModel = mongoose.model("User", UserSchema);
export const Proposal = safeModel("Proposal", ProposalSchema);
export const ProposalRating = safeModel("ProposalRating", ProposalRatingSchema);
export const Comment = safeModel("Comment", CommentSchema);
export const CommentRating = safeModel("CommentRating", CommentRatingSchema);
export const FinalVote = safeModel("FinalVote", FinalVoteSchema);
export const LoginCode = safeModel("LoginCode", LoginCodeSchema);
export const WinningProposal = safeModel(
  "WinningProposal",
  WinningProposalSchema,
);
export const SessionRequest = safeModel("SessionRequest", SessionRequestSchema);
export const BudgetVote = safeModel("BudgetVote", BudgetVoteSchema);
export const BudgetResult = safeModel("BudgetResult", BudgetResultSchema);
export const CitizenProposalRating = safeModel(
  "CitizenProposalRating",
  CitizenProposalRatingSchema,
);
export const MunicipalItemRating = safeModel(
  "MunicipalItemRating",
  MunicipalItemRatingSchema,
);
export const BudgetCategoryRating = safeModel(
  "BudgetCategoryRating",
  BudgetCategoryRatingSchema,
);

// Force-refresh Settings, Session, and CitizenProposal so schema updates always apply in dev (HMR)
if (mongoose.models["Settings"]) delete mongoose.models["Settings"];
export const Settings: AnyModel = mongoose.model("Settings", SettingsSchema);

if (mongoose.models["Session"]) delete mongoose.models["Session"];
export const Session: AnyModel = mongoose.model("Session", SessionSchema);

if (mongoose.models["CitizenProposal"])
  delete mongoose.models["CitizenProposal"];
export const CitizenProposal: AnyModel = mongoose.model(
  "CitizenProposal",
  CitizenProposalSchema,
);

// Force-refresh MunicipalMeeting and BudgetSession too — their item/category
// subdocument schemas change frequently (categories, images, ratings).
if (mongoose.models["MunicipalMeeting"])
  delete mongoose.models["MunicipalMeeting"];
export const MunicipalMeeting: AnyModel = mongoose.model(
  "MunicipalMeeting",
  MunicipalMeetingSchema,
);

if (mongoose.models["BudgetSession"]) delete mongoose.models["BudgetSession"];
export const BudgetSession: AnyModel = mongoose.model(
  "BudgetSession",
  BudgetSessionSchema,
);

// BudgetArgument - structured debate arguments tied to budget categories
const BudgetArgumentSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String, required: true },
    categoryId: { type: String, required: true },
    categoryName: { type: String, required: true },
    direction: { type: String, enum: ["up", "down"], required: true },
    text: { type: String, required: true, maxlength: 400 },
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One argument per user per category per direction
BudgetArgumentSchema.index(
  { sessionId: 1, userId: 1, categoryId: 1, direction: 1 },
  { unique: true },
);

export const BudgetArgument = safeModel("BudgetArgument", BudgetArgumentSchema);

// Question - a single Ja/Nej question with its own votes and discussion.
// Two origins: standalone questions created by admins (mobile Hem/Rösta tabs)
// and questions spawned from a MunicipalMeeting agenda item (meetingId set).
const QuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Please provide the question text"],
      maxlength: [300, "Question cannot be more than 300 characters"],
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      index: true,
    },
    // Required end-of-life date. Questions are never subject to
    // Settings.sessionLimitHours — they close when the deadline passes
    // (daily cron) or when an admin closes them manually.
    deadline: {
      type: Date,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    categories: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Set only for questions spawned from a municipal agenda item
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MunicipalMeeting",
      index: true,
    },
    closedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// QuestionVote - Ja / Nej / Avstår vote on a Question
const QuestionVoteSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    choice: { type: String, enum: ["ja", "nej"], required: true },
  },
  { timestamps: true },
);
QuestionVoteSchema.index({ questionId: 1, userId: 1 }, { unique: true });

// QuestionComment - för/emot/neutral discussion on a Question. Rating
// aggregates are computed at read time from QuestionCommentRating.
const QuestionCommentSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Please provide comment text"],
      maxlength: [1000, "Comment cannot be more than 1000 characters"],
    },
    type: {
      type: String,
      enum: ["for", "against", "neutral"],
      default: "neutral",
    },
  },
  { timestamps: true },
);

// QuestionCommentRating - 1-5 star rating on a QuestionComment
const QuestionCommentRatingSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionComment",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  { timestamps: true },
);
QuestionCommentRatingSchema.index(
  { commentId: 1, userId: 1 },
  { unique: true },
);

// Force-refresh Question — its schema will iterate during the restructure
if (mongoose.models["Question"]) delete mongoose.models["Question"];
export const Question: AnyModel = mongoose.model("Question", QuestionSchema);
export const QuestionVote = safeModel("QuestionVote", QuestionVoteSchema);
export const QuestionComment = safeModel(
  "QuestionComment",
  QuestionCommentSchema,
);
export const QuestionCommentRating = safeModel(
  "QuestionCommentRating",
  QuestionCommentRatingSchema,
);
