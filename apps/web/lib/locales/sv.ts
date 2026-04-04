/**
 * Swedish translations for Vallentuna Framåt
 */

export const sv = {
	// App name
	appName: "Vallentuna Framåt",

	// Common
	common: {
		loading: "Laddar...",
		save: "Spara",
		cancel: "Avbryt",
		close: "Stäng",
		back: "Tillbaka",
		backToHome: "Tillbaka till startsidan",
		backToStart: "Tillbaka till start",
		next: "Nästa",
		submit: "Skicka",
		delete: "Ta bort",
		edit: "Redigera",
		yes: "Ja",
		no: "Nej",
		search: "Sök",
		filter: "Filtrera",
		seconds: "sekunder",
	},

	// Authentication
	auth: {
		login: "Logga in",
		logout: "Logga ut",
		register: "Registrera",
		email: "E-post",
		password: "Lösenord",
		name: "Namn",
		requestCode: "Begär kod",
		enterCode: "Ange kod",
		hello: "Hej",
	},

	// Navigation
	nav: {
		admin: "Admin",
		home: "Hem",
		applyForAdmin: "Bli admin",
		manageSessions: "Hantera sessioner",
	},

	// Admin
	admin: {
		applyForAdmin: "Ansök om att bli admin",
		applicationSubmitted:
			"Din ansökan har skickats. En superadmin kommer att granska den inom kort.",
		alreadyAdmin: "Du har redan administratörsbehörighet",
		pendingApplication: "Du har redan en pågående admin-ansökan",
		applicationDenied:
			"Din tidigare ansökan nekades. Vänligen vänta 30 dagar innan du ansöker igen.",
		superadminPanel: "Superadmin Panel",
		adminApplications: "Admin-ansökningar",
		noPendingApplications: "Inga väntande ansökningar",
		applicant: "Sökande",
		appliedOn: "Ansökt",
		sessionLimit: "Sessionsgräns",
		approve: "Godkänn",
		deny: "Neka",
		approved: "Godkänd",
		denied: "Nekad",
		sessions: "Sessioner",
		activeSessionsLimit: "Aktiva sessioner: {current} / {limit}",
		unlimitedSessions: "Obegränsade sessioner",
		organization: "Organisation",
		organizationPlaceholder: "T.ex. 'Vallentuna kommun' eller 'Min förening'",
		requestedSessions: "Antal sessioner du vill kunna skapa",
		requestedSessionsHelp: "Ange hur många sessioner du förväntar dig att behöva (1-50)",
		whatToImprove: "Vad ska förbättras",
		whatToImprovePlaceholder: "T.ex. 'Vallentuna'",
		sessionManagement: "Sessionshantering",
		sessionsMovedMessage: "Sessionshantering har flyttats till en dedikerad sida för bättre organisation och tillgänglighet.",
		goToManageSessions: "Gå till Hantera sessioner",
	},

	// Manage Sessions
	manageSessions: {
		title: "Hantera sessioner",
		subtitle: "Skapa och hantera demokratisessioner",
	},

	// Phases
	phases: {
		phase1: "Fas 1",
		phase2: "Fas 2",
		rating: "Betygsättning",
		debateAndVoting: "Debatt och Omröstning",
		closed: "Avslutad",
		transitionToDebate: "Övergång till Debatt och Omröstning om",
		transitionToVoting: "Övergång till Omröstning om",
		transitionMessage:
			"Förslagen har rangordnats och övergår strax till debatt och omröstning.",
		transitionMessageVotingOnly:
			"Förslagen har rangordnats och övergår strax till omröstning.",
		ideaPhaseComplete: "Idéfasen är färdig!",
		nowToDebateAndVoting: "Nu till debatt och omröstning",
		nowToVoting: "Nu till omröstning",
	},

	// Proposals
	proposals: {
		proposeNewIdea: "Föreslå en ny idé",
		noActiveSession: "Ingen aktiv session",
		topProposals: "Toppförslag",
		allProposals: "Alla förslag",
		noProposals: "Inga förslag än. Lägg gärna alla förslag först så ger vi dem stjärnor sen!",
		noTopProposals: "Inga toppförslag än.",
		discussAndVote: "Diskutera och rösta på de mest populära idéerna",
		clickToDebateAndVote:
			"Klicka på ett förslag för att se argument och diskutera. När debatten är klar väljer du en fråga att lägga din röst på.",
		debate: "Debattera",
		debateTopProposals: "Debattera Toppförslagen",
		selectToDebate: "Välj ett förslag att debattera",
		selectForOrAgainst: "Välj om du vill argumentera för eller emot",
		cost: "Kostnad",
		vote: "Rösta",
		title: "Titel",
		problem: "Problem:",
		problemColon: "Problem:",
		solution: "Lösning:",
		solutionColon: "Lösning:",
		estimatedCost: "Kostnad/Vinst:",
		author: "Författare",
		howToImprove: "Vad vill du fråga om",
		howToImproveYourSpace: "Vad vill du fråga?",
		count: "({count})",
		allProposalsCount: "Alla förslag ({count})",
		topProposalsCount: "Toppförslag ({count})",
		lockTop3: "Lås topp 3 och börja diskutera",
		yourProposal: "Ditt förslag",
	},

	// Rating
	rating: {
		giveRating: "Ge betyg",
		changeRating: "Ändra betyg",
		clickStar: "Klicka på en stjärna",
		ratingRegistered: "Betyg {rating} registrerat!",
		yourRating: "Ditt betyg",
	},

	// Comments
	comments: {
		showArguments: "Visa argument",
		hide: "Dölj",
		writeArgument: "Skriv ett argument...",
		writeComment: "Skriv en kommentar...",
		send: "Skicka",
		sending: "Skickar...",
		neutral: "Neutral",
		for: "För",
		against: "Emot",
		noArgumentsYet: "Inga argument än. Var först!",
		noCommentsYet: "Inga kommentarer än. Var den första att diskutera!",
		noForArgumentsYet: "Inga förargument än.",
		noAgainstArgumentsYet: "Inga motargument än.",
		forArguments: "Förargument",
		againstArguments: "Motargument",
		loading: "Laddar argument...",
		loadingComments: "Laddar kommentarer...",
		discussion: "Diskussion",
		all: "Alla",
		writeFor: "Skriv förargument...",
		writeAgainst: "Skriv motargument...",
		previousFor: "Tidigare förargument",
		previousAgainst: "Tidigare motargument",
		yourComment: "Ditt argument",
	},

	// Voting
	voting: {
		vote: "Rösta",
		votingClosed: "Omröstningen är avslutad",
		weHaveResult: "Vi har ett resultat:",
		noMajority: "Inga förslag fick majoritet i omröstningen.",
		thanksForParticipation: "Tack för din medverkan!",
		youHaveVoted: "Du har röstat på detta förslag",
		alreadyUsedVote: "Du har redan använt din röst",
		limitedVotingRights: "Begränsad rösträtt",
		oneVotePerSession:
			"Du har rätt att rösta för eller emot endast ett (1) förslag.",
		votingAdvantages:
			"Prioriteringen ger din röst större tyngd. Välj med omsorg.",
		thanksForVote: "Tack för din röst!",
		sessionClosesWhen:
			"Omröstningen avslutas när alla har röstat eller tidsgränsen nås.",
		viewYourVote: "Visa din röst",
		voteOnTopProposals: "Rösta på Toppförslagen",
		chooseIdeasToImplement: "Välj vilka idéer som ska förverkligas",
		yes: "JA",
		no: "NEJ",
		yesShort: "Ja",
		noShort: "Nej",
		results: "Resultat",
		votesCount: "{count} röster",
		result: "Resultat",
		votes: "röster",
		youVoted: "Du har röstat",
		officialVoting: "Officiell Omröstning",
		yourVoteMatters: "Din röst är viktig för demokratin",
		noProposals: "Inga förslag att rösta på",
		proposalXOfY: "Förslag {current} av {total}",
		castYourVote: "Avge din röst",
		yesVotes: "JA-röster",
		noVotes: "NEJ-röster",
		totalVotes: "{count} röster totalt",
		nextProposal: "Nästa förslag",
		previous: "Föregående",
		next: "Nästa",
	},

	// Create proposal
	createProposal: {
		title: "Föreslå en ny idé",
		nameOfProposal: "Namn på ditt förslag *",
		nameExample: "T.ex. 'Fler cykelbanor i centrum'",
		problemLabel: "Vad är problemet? *",
		problemPlaceholder: "Beskriv vilket problem detta förslag löser...",
		solutionLabel: "Hur ser lösningen ut? *",
		solutionPlaceholder: "Beskriv din lösning i detalj...",
		costLabel: "Uppskattad kostnad *",
		costPlaceholder:
			"T.ex. '100 000 kr', 'Låg kostnad', 'Ingen extra kostnad'",
		submit: "Skicka in förslag",
		submitting: "Skickar...",
		error: "Ett fel uppstod vid skapande av förslag",
	},

	// Sessions
	sessions: {
		selectSession: "Välkommen att påverka!",
		noActiveSessions: "Inga aktiva sessioner",
		checkBackLater: "Kom tillbaka senare eller kontakta en administratör för att skapa en session.",
		activeUsers: "aktiva",
	},

	// Survey sessions (legacy)
	survey: {
		addResponse: "Lägg till ditt svar",
		liveRankings: "Live-rankning",
		noResponses: "Inga svar än. Bli den första att svara!",
		ratings: "betyg",
		timeRemaining: "Tid kvar",
		resultsArchived: "Resultaten arkiveras när tiden går ut",
		surveyEnded: "Undersökningen avslutad",
	},

	// Ranking sessions
	ranking: {
		addResponse: "Lägg till ditt svar",
		liveRankings: "Live-rankning",
		noResponses: "Inga svar än. Bli den första att svara!",
		ratings: "betyg",
		timeRemaining: "Tid kvar",
		resultsArchived: "Resultaten arkiveras när tiden går ut",
		rankingEnded: "Rankning avslutad",
	},

	// Archive
	archive: {
		archivedSurveys: "Arkiverade undersökningar",
		archivedRankings: "Arkivet",
		archived: "Arkiverad",
		participants: "deltagare",
		notFound: "Arkiverad session hittades inte",
		topResponse: "Toppsvar",
		finalRankings: "Slutresultat",
		noResponses: "Inga svar skickades in för denna rankning.",
	},

	// Poll
	poll: {
		poll: "Omröstning",
		noActivePoll: "Ingen aktiv omröstning",
		checkBackLater: "Det finns ingen omröstning tillgänglig just nu. Kom tillbaka senare.",
		yourVote: "Din röst",
		votes: "röster",
		totalVotes: "totalt antal röster",
		selectToSeeResults: "Välj ett alternativ och skicka för att se resultaten",
		refreshResults: "Uppdatera resultat",
		submitting: "Skickar...",
		updateVote: "Uppdatera röst",
		submitVote: "Skicka röst",
		canChangeVote: "Du kan ändra din röst när som helst medan omröstningen är aktiv.",
	},

	// Errors
	errors: {
		generic: "Ett fel uppstod",
		votingError: "Ett fel uppstod vid röstning",
		unauthorized: "You have to be logged in",
		forbidden: "Du har inte behörighet",
		alreadySubmittedProposal: "Du har redan lagt ett förslag i denna fråga.",
	},

	// Login page
	login: {
		subtitle: "Logga in utan lösenord",
		email: "E-post",
		emailPlaceholder: "din@email.com",
		sendCode: "Skicka kod",
		sending: "Skickar...",
		codeSent: "Kod skickad! Kontrollera din e-post.",
		couldNotSendCode: "Kunde inte skicka kod",
		code: "Kod (6 siffror)",
		codeSentTo: "Vi skickade koden till",
		verifying: "Verifierar...",
		login: "Logga in",
		loginError: "Fel vid inloggning",
		resendCode: "Skicka koden igen",
		resendIn: "Skicka igen om {seconds}s",
		changeEmail: "Byt e-postadress",
		newHere: "Ny här?",
		createAccount: "Skapa konto",
		aboutLink: "Om Jämlik Demokrati",
	},

	// About page
	about: {
		title: "Om Jämlik Demokrati",
		subtitle: "Ett demokratiskt verktyg för medborgardeltagande",
		whatIs: "Vad är Jämlik Demokrati?",
		introduction:
			"Jämlik Demokrati är en plattform för demokratiskt beslutsfattande där alla medborgare har lika mycket att säga till om. Systemet använder begränsad rösträtt och algoritmisk rangordning för att säkerställa att de bästa idéerna kommer fram.",
		howItWorks: "Hur fungerar det?",
		phase1Title: "Fas 1: Idégenerering och Betygsättning",
		phase1Description:
			"Medborgare föreslår idéer och betygsätter andras förslag. De bästa idéerna går vidare till nästa fas.",
		phase2Title: "Fas 2: Debatt och Omröstning",
		phase2Description:
			"De bästa förslagen diskuteras. Medborgare kan lägga fram argument för och emot, och betygsätta varandras argument. Slutligen röstar alla på ett förslag.",
		phase3Title: "Fas 3: Resultat",
		phase3Description:
			"Det vinnande förslaget med majoritetsstöd presenteras och kan genomföras.",
		keyFeatures: "Nyckelfunktioner",
		feature1:
			"Begränsad rösträtt: Varje medborgare har en röst per session",
		feature2:
			"Algoritmisk rangordning: De bästa idéerna sorteras automatiskt",
		feature3: "Transparent process: All debatt och alla röster är synliga",
		feature4:
			"Anonym deltagande: Skydda din identitet samtidigt som du deltar",
		feature5:
			"Flerspråksstöd: Tillgängligt på svenska, engelska, tyska, spanska och serbiska",
		getInvolved: "Engagera dig!",
		getInvolvedDescription:
			"Gå med i vårt demokratiska samhälle och få din röst hörd. Tillsammans kan vi fatta bättre beslut.",
		joinNow: "Gå med nu",
	},

	// Budget
	budget: {
		title: "Budgetapp",
		information: "Information",
		budgetSummary: "Budgetsammanfattning",
		income: "Intäkter",
		expenses: "Utgifter",
		balance: "Balans",
		incomeSources: "Intäktskällor",
		expenseCategories: "Utgiftskategorier",
		saveBudgetProposal: "Spara budgetförslag",
		saving: "Sparar...",
		budgetAdmin: "Budgetadmin",

		// Info messages
		infoChartShows: "Diagrammet visar utgifter och intäkter.",
		infoClickBox: "Klicka på en ruta i diagrammet för mer information.",
		infoAdjustAllocations: "Justera budgetallokeringar genom att dra reglagen eller ange nya belopp",
		infoMinimumAmounts: "Oundvikliga minimibelopp kan inte minskas",
		infoIncomeGreater: "Dina totala intäkter bör vara större än dina utgifter",
		infoMedianProposal: "Efter omröstningen blir medianen av alla förslag det gemensamma budgetförslaget",

		// Success/Error messages
		proposalSaved: "Ditt budgetförslag har sparats!",
		failedToSave: "Kunde inte spara budgetförslaget",
		sessionNotFound: "Session hittades inte",
		sessionNotActive: "Budgetsessionen är inte aktiv",
		loadingSession: "Laddar budgetsession...",
		goBack: "Gå tillbaka",

		// Validation messages
		validation: {
			belowMinimum: "{category}: Beloppet {amount} mnkr är under minimum {minimum} mnkr",
			subcategoryBelowMinimum: "{category} - {subcategory}: Beloppet {amount} mnkr är under minimum {minimum} mnkr",
			categoryNotFound: "Kategori {categoryId} hittades inte",
			subcategoryNotFound: "Underkategori {subcategoryId} hittades inte",
		},

		// Budget admin
		createBudgetSession: "Skapa ny budgetsession",
		manageBudgetSessions: "Hantera budgetsessioner",
		sessionName: "Sessionsnamn",
		municipality: "Kommun",
		totalBudget: "Total budget",
		taxBase: "Skatteunderlag",
		status: "Status",
		active: "Aktiv",
		draft: "Utkast",
		closed: "Avslutad",
		startDate: "Startdatum",
		endDate: "Slutdatum",
		noActiveSessions: "Inga aktiva budgetsessioner",
		noDraftSessions: "Inga utkast",
		noClosedSessions: "Inga avslutade sessioner",

		// Amounts
		mnkr: "mnkr",
		kr: "kr",
		taxRate: "Skattesats",
	},

	// Email
	email: {
		loginCode: {
			subject: "Din engångskod för inloggning",
			yourCode: "Din kod är: {code}",
			codeValid:
				"Denna kod är giltig i 10 minuter. Om du inte begärde denna kod kan du ignorera detta e-postmeddelande.",
			title: "Din inloggningskod",
			useCodeBelow:
				"Använd koden nedan för att logga in. Den är giltig i 10 minuter.",
			ignoreIfNotRequested:
				"Om du inte begärde denna kod kan du ignorera detta meddelande.",
		},
		sessionResults: {
			subject: "Tack för din medverkan i {place}s session",
			thankYou: "Tack för att du har varit med och utvecklat demokratin!",
			session: "{place}s session",
			proposalsVotedThrough: "Dessa förslag har röstats igenom:",
			noMajority:
				"Tyvärr fick inget förslag majoritet den här gången.",
			yesVotes: "ja-röster",
			noVotes: "nej-röster",
			electionPromise:
				"Om vi vinner valet lovar vi att ge möjlighet att påverka lokalpolitiken på en helt ny nivå.",
			bestRegards: "Med vänliga hälsningar",
		},
		broadcast: {
			bestRegards: "Med vänliga hälsningar",
		},
		adminApplication: {
			subject: "Ny admin-ansökan",
			newApplication: "En ny användare har ansökt om att bli admin.",
			applicantName: "Namn",
			applicantEmail: "E-post",
			organization: "Organisation",
			requestedSessions: "Antal sessioner",
			reviewPrompt:
				"Logga in på admin-panelen för att granska och godkänna/avslå ansökan.",
			bestRegards: "Med vänliga hälsningar",
		},
		adminApproval: {
			subject: "Din admin-ansökan har godkänts",
			congratulations: "Grattis {name}!",
			approved: "Din ansökan om att bli admin har godkänts.",
			sessionLimit: "Du kan skapa upp till {limit} sessioner.",
			accessInstructions:
				"Logga in på plattformen för att komma åt admin-panelen och börja skapa sessioner.",
			bestRegards: "Med vänliga hälsningar",
		},
		adminDenial: {
			subject: "Din admin-ansökan har avslagits",
			greeting: "Hej {name},",
			denied: "Din ansökan om att bli admin har tyvärr avslagits.",
			explanation:
				"Tack för ditt intresse för att bli admin. Efter granskning har vi beslutat att inte godkänna din ansökan just nu.",
			reapplyInstructions:
				"Du kan ansöka igen om 30 dagar om du fortfarande är intresserad.",
			bestRegards: "Med vänliga hälsningar",
		},
		unsubscribe: {
			text: "Du får detta e-postmeddelande eftersom du har ett konto på Vallentuna Framåt.",
			linkText: "Avprenumerera från e-post",
		},
	},
};
