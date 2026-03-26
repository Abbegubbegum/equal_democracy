/**
 * English translations for Equal Democracy
 */

export const en = {
	// App name
	appName: "Equal Democracy",

	// Common
	common: {
		loading: "Loading...",
		save: "Save",
		cancel: "Cancel",
		close: "Close",
		back: "Back",
		backToHome: "Back to Home",
		backToStart: "Back to start",
		next: "Next",
		submit: "Submit",
		delete: "Delete",
		edit: "Edit",
		yes: "Yes",
		no: "No",
		search: "Search",
		filter: "Filter",
		seconds: "seconds",
	},

	// Authentication
	auth: {
		login: "Log in",
		logout: "Log out",
		register: "Register",
		email: "Email",
		password: "Password",
		name: "Name",
		requestCode: "Request code",
		enterCode: "Enter code",
		hello: "Hello",
	},

	// Navigation
	nav: {
		admin: "Admin",
		home: "Home",
		applyForAdmin: "Apply for admin",
		manageSessions: "Manage Sessions",
	},

	// Admin
	admin: {
		applyForAdmin: "Apply to become admin",
		applicationSubmitted:
			"Your application has been submitted. A superadmin will review it shortly.",
		alreadyAdmin: "You already have admin privileges",
		pendingApplication: "You already have a pending admin application",
		applicationDenied:
			"Your previous application was denied. Please wait 30 days before reapplying.",
		superadminPanel: "Superadmin Panel",
		adminApplications: "Admin Applications",
		noPendingApplications: "No pending applications",
		applicant: "Applicant",
		appliedOn: "Applied on",
		sessionLimit: "Session limit",
		approve: "Approve",
		deny: "Deny",
		approved: "Approved",
		denied: "Denied",
		sessions: "Sessions",
		activeSessionsLimit: "Active sessions: {current} / {limit}",
		unlimitedSessions: "Unlimited sessions",
		organization: "Organization",
		organizationPlaceholder: "e.g. 'City Council' or 'My Association'",
		requestedSessions: "Number of sessions you want to create",
		requestedSessionsHelp: "Enter how many sessions you expect to need (1-50)",
		whatToImprove: "What to Improve",
		whatToImprovePlaceholder: "e.g. 'City Name'",
		sessionManagement: "Session Management",
		sessionsMovedMessage: "Session management has been moved to a dedicated page for better organization and accessibility.",
		goToManageSessions: "Go to Manage Sessions",
	},

	// Manage Sessions
	manageSessions: {
		title: "Manage Sessions",
		subtitle: "Create and manage democracy sessions",
	},

	// Phases
	phases: {
		phase1: "Phase 1",
		phase2: "Phase 2",
		rating: "Rating",
		debateAndVoting: "Debate and Voting",
		closed: "Closed",
		transitionToDebate: "Transition to Debate and Voting in",
		transitionMessage:
			"The proposals have been ranked and will soon transition to debate and voting.",
		ideaPhaseComplete: "Idea phase complete!",
		nowToDebateAndVoting: "Now to debate and voting",
	},

	// Proposals
	proposals: {
		proposeNewIdea: "Propose a new idea",
		noActiveSession: "No active session",
		topProposals: "Top Proposals",
		allProposals: "All Proposals",
		noProposals: "No proposals yet. Feel free to add all proposals first, then we'll give them stars later!",
		noTopProposals: "No top proposals yet.",
		discussAndVote: "Discuss and vote on the most popular ideas",
		clickToDebateAndVote:
			"Click on a proposal to see arguments and discuss. When the debate is complete, choose a question to cast your vote on.",
		debate: "Debate",
		debateTopProposals: "Debate Top Proposals",
		selectToDebate: "Select a proposal to debate",
		selectForOrAgainst: "Choose whether you want to argue for or against",
		cost: "Cost",
		vote: "Vote",
		title: "Title",
		problem: "Problem:",
		problemColon: "Problem:",
		solution: "Solution:",
		solutionColon: "Solution:",
		estimatedCost: "Cost/Benefit:",
		author: "Author",
		howToImprove: "What do you want to ask about",
		howToImproveYourSpace: "What do you want to ask?",
		count: "({count})",
		allProposalsCount: "All proposals ({count})",
		topProposalsCount: "Top proposals ({count})",
		lockTop3: "Lock top 3 and start discussion",
		yourProposal: "Your proposal",
	},

	// Rating
	rating: {
		giveRating: "Give rating",
		changeRating: "Change rating",
		clickStar: "Click a star",
		ratingRegistered: "Rating {rating} registered!",
		yourRating: "Your rating",
	},

	// Comments
	comments: {
		showArguments: "Show arguments",
		hide: "Hide",
		writeArgument: "Write an argument...",
		writeComment: "Write a comment...",
		send: "Send",
		sending: "Sending...",
		neutral: "Neutral",
		for: "For",
		against: "Against",
		noArgumentsYet: "No arguments yet. Be first!",
		noCommentsYet: "No comments yet. Be the first to discuss!",
		noForArgumentsYet: "No arguments for yet.",
		noAgainstArgumentsYet: "No arguments against yet.",
		forArguments: "Arguments for",
		againstArguments: "Arguments against",
		loading: "Loading arguments...",
		loadingComments: "Loading comments...",
		discussion: "Discussion",
		all: "All",
		writeFor: "Write arguments for...",
		writeAgainst: "Write arguments against...",
		previousFor: "Previous arguments for",
		previousAgainst: "Previous arguments against",
		yourComment: "Your argument",
	},

	// Voting
	voting: {
		vote: "Vote",
		votingClosed: "Voting is closed",
		weHaveResult: "We have a result:",
		noMajority: "No proposals received a majority in the voting.",
		thanksForParticipation: "Thank you for your participation!",
		youHaveVotedProposal: "You have voted on this proposal",
		alreadyUsedVote: "You have already used your vote",
		limitedVotingRights: "Limited Voting Rights",
		oneVotePerSession:
			"You have the right to vote for or against only one (1) proposal.",
		votingAdvantages:
			"Prioritization gives your vote greater weight. Choose carefully.",
		thanksForVote: "Thank you for your vote!",
		sessionClosesWhen:
			"Voting closes when everyone has voted or the time limit is reached.",
		viewYourVote: "View Your Vote",
		voteOnTopProposals: "Vote on Top Proposals",
		chooseIdeasToImplement: "Choose which ideas to implement",
		yes: "YES",
		no: "NO",
		yesShort: "Yes",
		noShort: "No",
		results: "Results",
		votesCount: "{count} votes",
		youHaveVoted: "You have voted",
		result: "Result",
		votes: "votes",
		youVoted: "You voted",
		officialVoting: "Official Voting",
		yourVoteMatters: "Your vote matters for democracy",
		noProposals: "No proposals to vote on",
		proposalXOfY: "Proposal {current} of {total}",
		castYourVote: "Cast your vote",
		yesVotes: "YES votes",
		noVotes: "NO votes",
		totalVotes: "{count} votes total",
		nextProposal: "Next proposal",
		previous: "Previous",
		next: "Next",
	},

	// Create proposal
	createProposal: {
		title: "Propose a new idea",
		nameOfProposal: "Name of your proposal *",
		nameExample: "E.g. 'More bike lanes in the city center'",
		problemLabel: "What is the problem? *",
		problemPlaceholder: "Describe what problem this proposal solves...",
		solutionLabel: "What does the solution look like? *",
		solutionPlaceholder: "Describe your solution in detail...",
		costLabel: "Estimated cost *",
		costPlaceholder: "E.g. '$100,000', 'Low cost', 'No additional cost'",
		submit: "Submit proposal",
		submitting: "Submitting...",
		error: "An error occurred while creating the proposal",
	},

	// Sessions
	sessions: {
		selectSession: "Select a session to participate",
		noActiveSessions: "No active sessions",
		checkBackLater: "Check back later or contact an administrator to create a session.",
		activeUsers: "active",
	},

	// Survey sessions (legacy)
	survey: {
		addResponse: "Add your response",
		liveRankings: "Live Rankings",
		noResponses: "No responses yet. Be the first to respond!",
		ratings: "ratings",
		timeRemaining: "Time remaining",
		resultsArchived: "Results will be archived when time expires",
		surveyEnded: "Survey ended",
	},

	// Ranking sessions
	ranking: {
		addResponse: "Add your response",
		liveRankings: "Live Rankings",
		noResponses: "No responses yet. Be the first to respond!",
		ratings: "ratings",
		timeRemaining: "Time remaining",
		resultsArchived: "Results will be archived when time expires",
		rankingEnded: "Ranking ended",
	},

	// Archive
	archive: {
		archivedSurveys: "Archived Surveys",
		archivedRankings: "Archived Rankings",
		archived: "Archived",
		participants: "participants",
		notFound: "Archived session not found",
		topResponse: "Top Response",
		finalRankings: "Final Rankings",
		noResponses: "No responses were submitted for this ranking.",
	},

	// Poll
	poll: {
		poll: "Poll",
		noActivePoll: "No Active Poll",
		checkBackLater: "There is no poll available at the moment. Please check back later.",
		yourVote: "Your vote",
		votes: "votes",
		totalVotes: "total votes",
		selectToSeeResults: "Select an option and submit to see results",
		refreshResults: "Refresh results",
		submitting: "Submitting...",
		updateVote: "Update Vote",
		submitVote: "Submit Vote",
		canChangeVote: "You can change your vote at any time while the poll is active.",
	},

	// Errors
	errors: {
		generic: "An error occurred",
		votingError: "An error occurred while voting",
		unauthorized: "You must be logged in",
		forbidden: "You do not have permission",
		alreadySubmittedProposal: "You have already submitted a proposal in this session.",
	},

	// Login page
	login: {
		subtitle: "Log in without password",
		email: "Email",
		emailPlaceholder: "your@email.com",
		sendCode: "Send code",
		sending: "Sending...",
		codeSent: "Code sent! Check your email.",
		couldNotSendCode: "Could not send code",
		code: "Code (6 digits)",
		codeSentTo: "We sent the code to",
		verifying: "Verifying...",
		login: "Log in",
		loginError: "Login error",
		changeEmail: "Change email address",
		newHere: "New here?",
		createAccount: "Create account",
		aboutLink: "About Equal Democracy",
	},

	// About page
	about: {
		title: "About Equal Democracy",
		subtitle: "A democratic tool for citizen participation",
		whatIs: "What is Equal Democracy?",
		introduction:
			"Equal Democracy is a platform for democratic decision-making where all citizens have an equal say. The system uses limited voting rights and algorithmic ranking to ensure the best ideas come forward.",
		howItWorks: "How does it work?",
		phase1Title: "Phase 1: Idea Generation and Rating",
		phase1Description:
			"Citizens propose ideas and rate others' proposals. The best ideas move forward to the next phase.",
		phase2Title: "Phase 2: Debate and Voting",
		phase2Description:
			"The best proposals are discussed. Citizens can present arguments for and against, and rate each other's arguments. Finally, everyone votes on one proposal.",
		phase3Title: "Phase 3: Results",
		phase3Description:
			"The winning proposal with majority support is presented and can be implemented.",
		keyFeatures: "Key Features",
		feature1:
			"Limited voting rights: Each citizen has one vote per session",
		feature2:
			"Algorithmic ranking: The best ideas are automatically sorted",
		feature3: "Transparent process: All debate and votes are visible",
		feature4:
			"Anonymous participation: Protect your identity while participating",
		feature5:
			"Multi-language support: Available in Swedish, English, German, Spanish, and Serbian",
		getInvolved: "Get Involved!",
		getInvolvedDescription:
			"Join our democratic community and have your voice heard. Together we can make better decisions.",
		joinNow: "Join Now",
	},

	// Budget
	budget: {
		title: "Budget App",
		information: "Information",
		budgetSummary: "Budget Summary",
		income: "Income",
		expenses: "Expenses",
		balance: "Balance",
		incomeSources: "Income Sources",
		expenseCategories: "Expense Categories",
		saveBudgetProposal: "Save Budget Proposal",
		saving: "Saving...",
		budgetAdmin: "Budget Admin",

		// Info messages
		infoChartShows: "The chart shows expenses and income.",
		infoClickBox: "Click a box in the chart for more information.",
		infoAdjustAllocations: "Adjust budget allocations by dragging the sliders or entering new amounts",
		infoMinimumAmounts: "Inevitable minimum amounts cannot be reduced",
		infoIncomeGreater: "Your total income should be greater than your expenses",
		infoMedianProposal: "After the vote is over, the median of all proposals becomes the joint budget proposal",

		// Success/Error messages
		proposalSaved: "Your budget proposal has been saved successfully!",
		failedToSave: "Failed to save vote",
		sessionNotFound: "Session not found",
		sessionNotActive: "Budget session is not active",
		loadingSession: "Loading budget session...",
		goBack: "Go Back",

		// Validation messages
		validation: {
			belowMinimum: "{category}: Amount {amount} MSEK is below minimum {minimum} MSEK",
			subcategoryBelowMinimum: "{category} - {subcategory}: Amount {amount} MSEK is below minimum {minimum} MSEK",
			categoryNotFound: "Category {categoryId} not found",
			subcategoryNotFound: "Subcategory {subcategoryId} not found",
		},

		// Budget admin
		createBudgetSession: "Create New Budget Session",
		manageBudgetSessions: "Manage Budget Sessions",
		sessionName: "Session Name",
		municipality: "Municipality",
		totalBudget: "Total Budget",
		taxBase: "Tax Base",
		status: "Status",
		active: "Active",
		draft: "Draft",
		closed: "Closed",
		startDate: "Start Date",
		endDate: "End Date",
		noActiveSessions: "No active budget sessions",
		noDraftSessions: "No drafts",
		noClosedSessions: "No closed sessions",

		// Amounts
		mnkr: "MSEK",
		kr: "SEK",
		taxRate: "Tax Rate",
	},

	// Email
	email: {
		loginCode: {
			subject: "Your one-time login code",
			yourCode: "Your code is: {code}",
			codeValid:
				"This code is valid for 10 minutes. If you did not request this code, you can ignore this email.",
			title: "Your login code",
			useCodeBelow:
				"Use the code below to log in. It is valid for 10 minutes.",
			ignoreIfNotRequested:
				"If you did not request this code, you can ignore this message.",
		},
		sessionResults: {
			subject: "Thank you for your participation in {place}'s session",
			thankYou: "Thank you for participating and developing democracy!",
			session: "{place}'s session",
			proposalsVotedThrough: "These proposals were voted through:",
			noMajority:
				"Unfortunately, no proposals achieved a majority this time.",
			yesVotes: "yes votes",
			noVotes: "no votes",
			electionPromise:
				"If we win the election, we promise to put forward these proposals and provide an opportunity to influence local politics at a whole new level.",
			bestRegards: "Best regards",
		},
		broadcast: {
			bestRegards: "Best regards",
		},
		adminApplication: {
			subject: "New Admin Application",
			newApplication: "A new user has applied to become an admin.",
			applicantName: "Name",
			applicantEmail: "Email",
			organization: "Organization",
			requestedSessions: "Requested Sessions",
			reviewPrompt:
				"Log in to the admin panel to review and approve/deny the application.",
			bestRegards: "Best regards",
		},
		adminApproval: {
			subject: "Your Admin Application Has Been Approved",
			congratulations: "Congratulations {name}!",
			approved: "Your application to become an admin has been approved.",
			sessionLimit: "You can create up to {limit} sessions.",
			accessInstructions:
				"Log in to the platform to access the admin panel and start creating sessions.",
			bestRegards: "Best regards",
		},
		adminDenial: {
			subject: "Your Admin Application Has Been Denied",
			greeting: "Hello {name},",
			denied: "Unfortunately, your application to become an admin has been denied.",
			explanation:
				"Thank you for your interest in becoming an admin. After review, we have decided not to approve your application at this time.",
			reapplyInstructions:
				"You can apply again in 30 days if you are still interested.",
			bestRegards: "Best regards",
		},
		unsubscribe: {
			text: "You are receiving this email because you have an account on Equal Democracy.",
			linkText: "Unsubscribe from emails",
		},
	},
};
