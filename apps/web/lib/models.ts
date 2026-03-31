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
		// Membership & Citizen participation
		isMember: {
			type: Boolean,
			default: false,
			index: true,
		},
		userType: {
			type: String,
			enum: ["citizen", "member", "none"],
			default: "none",
			index: true,
		},
		// BankID verification (for future use)
		bankIdVerified: {
			type: Boolean,
			default: false,
		},
		bankIdPersonalNumber: {
			type: String,
			// Encrypted personal number for verification
		},
		// Interest categories (max 3)
		interestedCategories: {
			type: [Number],
			default: [],
			validate: {
				validator: function (v) {
					return v.length <= 3;
				},
				message: "Maximum 3 categories allowed",
			},
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
		// Voting tracking
		lastCitizenVoteDate: {
			type: Date,
			// For tracking annual vote limit for citizens
		},
		votesUsedInCurrentYear: {
			type: Number,
			default: 0,
			// Reset annually for citizens
		},
		// Council member permissions
		canCloseQuestions: {
			type: Boolean,
			default: false,
			// For fullmäktige representatives
		},
		// Email opt-out (unsubscribe from non-essential emails)
		emailOptOut: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	}
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
	{ timestamps: true }
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
		authorName: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ["active", "top3", "archived"],
			default: "active",
		},
		thumbsUpCount: {
			type: Number,
			default: 0,
		},
		averageRating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// ThumbsUp Model (now supports 1-5 star rating)
const ThumbsUpSchema = new mongoose.Schema(
	{
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
	}
);

ThumbsUpSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Comment Model (supports for/against/neutral)
const CommentSchema = new mongoose.Schema(
	{
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
		authorName: {
			type: String,
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
		averageRating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// CommentRating Model - for rating comments/arguments (similar to ThumbsUp for proposals)
const CommentRatingSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
			index: true,
		},
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
	}
);

// Add index for efficient sorting by rating
CommentSchema.index({ averageRating: -1, createdAt: -1 });

CommentRatingSchema.index({ commentId: 1, userId: 1 }, { unique: true });

// FinalVote Model
const FinalVoteSchema = new mongoose.Schema(
	{
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
	}
);

FinalVoteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Session Model - represents a voting round/session
const SessionSchema = new mongoose.Schema(
	{
		place: {
			type: String,
			required: true,
			maxlength: [100, "Place name cannot be more than 100 characters"],
		},
		// Session type: "standard" (2-phase democracy), "survey" (phase1-only with time limit)
		sessionType: {
			type: String,
			enum: ["standard", "survey", "municipal"],
			default: "standard",
			index: true,
		},
		status: {
			type: String,
			enum: ["active", "closed", "archived"],
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
		// For survey sessions: when the session should be archived
		archiveDate: {
			type: Date,
		},
		// Duration in days for survey sessions (default 6)
		surveyDurationDays: {
			type: Number,
			default: 6,
			min: 1,
			max: 365,
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
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// TopProposal Model - winning proposals from closed sessions (top3 with yes-majority)
const TopProposalSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
		},
		sessionPlace: {
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
		authorName: {
			type: String,
			required: true,
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
	}
);

// MunicipalSession Model - for council meetings (kommunfullmäktige)
const MunicipalSessionSchema = new mongoose.Schema(
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
				categories: [Number], // 1-7 category codes
				proposalId: {
					// Link to created Proposal for voting
					type: mongoose.Schema.Types.ObjectId,
					ref: "Proposal",
				},
				sessionId: {
					// Link to created Session for this specific item
					type: mongoose.Schema.Types.ObjectId,
					ref: "Session",
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
	}
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
			type: [Number],
			default: [],
			validate: {
				validator: function (v) {
					return v.length >= 1 && v.length <= 3;
				},
				message: "1-3 categories required",
			},
		},
		authorId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		authorName: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ["active", "selected", "submitted_as_motion", "rejected", "archived"],
			default: "active",
			index: true,
		},
		// Ranking data (open ranking, total stars)
		totalStars: {
			type: Number,
			default: 0,
			index: true, // For sorting by popularity
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
		// If selected for municipal session
		selectedForMunicipalSession: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "MunicipalSession",
		},
		selectedAt: {
			type: Date,
		},
		// Motion details if submitted
		submittedAsMotionAt: {
			type: Date,
		},
		motionNumber: {
			type: String,
		},
		createdAt: {
			type: Date,
			default: Date.now,
			index: true,
		},
	},
	{
		timestamps: true,
	}
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
	}
);

// One rating per user per proposal
CitizenProposalRatingSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

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
		sessionLimitHours: {
			type: Number,
			default: 24,
			min: 1,
			max: 168, // Max 1 week
		},
		updatedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
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
	}
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
	}
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
	}
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
	}
);

// Survey Model - represents a survey with a question and multiple choices
const SurveySchema = new mongoose.Schema(
	{
		question: {
			type: String,
			required: [true, "Please provide a question"],
			maxlength: [500, "Question cannot be more than 500 characters"],
		},
		choices: [
			{
				id: {
					type: String,
					required: true,
				},
				text: {
					type: String,
					required: true,
					maxlength: [200, "Choice cannot be more than 200 characters"],
				},
			},
		],
		status: {
			type: String,
			enum: ["active", "closed"],
			default: "active",
			index: true,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// SurveyVote Model - tracks anonymous votes (by visitorId for non-logged-in users)
const SurveyVoteSchema = new mongoose.Schema(
	{
		surveyId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Survey",
			required: true,
			index: true,
		},
		visitorId: {
			type: String,
			required: true,
			index: true,
		},
		choiceId: {
			type: String,
			required: true,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// Ensure one vote per visitor per survey
SurveyVoteSchema.index({ surveyId: 1, visitorId: 1 }, { unique: true });

type AnyModel = mongoose.Model<any>;

function safeModel(name: string, schema: mongoose.Schema): AnyModel {
	return ((mongoose.models[name] as AnyModel | undefined) ?? mongoose.model(name, schema)) as AnyModel;
}

// Export models
export const User = safeModel("User", UserSchema);
export const Proposal = safeModel("Proposal", ProposalSchema);
export const ThumbsUp = safeModel("ThumbsUp", ThumbsUpSchema);
export const Comment = safeModel("Comment", CommentSchema);
export const CommentRating = safeModel("CommentRating", CommentRatingSchema);
export const FinalVote = safeModel("FinalVote", FinalVoteSchema);
export const LoginCode = safeModel("LoginCode", LoginCodeSchema);
export const TopProposal = safeModel("TopProposal", TopProposalSchema);
export const SessionRequest = safeModel("SessionRequest", SessionRequestSchema);
export const BudgetSession = safeModel("BudgetSession", BudgetSessionSchema);
export const BudgetVote = safeModel("BudgetVote", BudgetVoteSchema);
export const BudgetResult = safeModel("BudgetResult", BudgetResultSchema);
export const Survey = safeModel("Survey", SurveySchema);
export const SurveyVote = safeModel("SurveyVote", SurveyVoteSchema);
export const MunicipalSession = safeModel("MunicipalSession", MunicipalSessionSchema);
export const CitizenProposal = safeModel("CitizenProposal", CitizenProposalSchema);
export const CitizenProposalRating = safeModel("CitizenProposalRating", CitizenProposalRatingSchema);

// Force-refresh Settings and Session so schema updates always apply in dev (HMR)
if (mongoose.models["Settings"]) delete mongoose.models["Settings"];
export const Settings: AnyModel = mongoose.model("Settings", SettingsSchema);

if (mongoose.models["Session"]) delete mongoose.models["Session"];
export const Session: AnyModel = mongoose.model("Session", SessionSchema);

// BudgetArgument - structured debate arguments tied to budget categories
const BudgetArgumentSchema = new mongoose.Schema(
	{
		sessionId: { type: String, required: true, index: true },
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		userName: { type: String, required: true },
		categoryId: { type: String, required: true },
		categoryName: { type: String, required: true },
		direction: { type: String, enum: ["up", "down"], required: true },
		text: { type: String, required: true, maxlength: 400 },
		helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		isHidden: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

// One argument per user per category per direction
BudgetArgumentSchema.index(
	{ sessionId: 1, userId: 1, categoryId: 1, direction: 1 },
	{ unique: true }
);

export const BudgetArgument = safeModel("BudgetArgument", BudgetArgumentSchema);
