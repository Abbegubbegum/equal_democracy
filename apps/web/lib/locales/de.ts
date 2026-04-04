/**
 * German translations for Equal Democracy
 */

export const de = {
	// App name
	appName: "Gleiche Demokratie",

	// Common
	common: {
		loading: "Laden...",
		save: "Speichern",
		cancel: "Abbrechen",
		close: "Schließen",
		back: "Zurück",
		backToHome: "Zurück zur Startseite",
		backToStart: "Zurück zum Start",
		next: "Weiter",
		submit: "Senden",
		delete: "Löschen",
		edit: "Bearbeiten",
		yes: "Ja",
		no: "Nein",
		search: "Suchen",
		filter: "Filtern",
		seconds: "Sekunden",
	},

	// Authentication
	auth: {
		login: "Anmelden",
		logout: "Abmelden",
		register: "Registrieren",
		email: "E-Mail",
		password: "Passwort",
		name: "Name",
		requestCode: "Code anfordern",
		enterCode: "Code eingeben",
		hello: "Hallo",
	},

	// Navigation
	nav: {
		admin: "Verwaltung",
		home: "Startseite",
		applyForAdmin: "Als Admin bewerben",
		manageSessions: "Sitzungen verwalten",
	},

	// Admin
	admin: {
		applyForAdmin: "Als Admin bewerben",
		applicationSubmitted:
			"Ihre Bewerbung wurde eingereicht. Ein Superadmin wird sie in Kürze überprüfen.",
		alreadyAdmin: "Sie haben bereits Administratorrechte",
		pendingApplication: "Sie haben bereits eine ausstehende Admin-Bewerbung",
		applicationDenied:
			"Ihre vorherige Bewerbung wurde abgelehnt. Bitte warten Sie 30 Tage, bevor Sie sich erneut bewerben.",
		superadminPanel: "Superadmin-Panel",
		adminApplications: "Admin-Bewerbungen",
		noPendingApplications: "Keine ausstehenden Bewerbungen",
		applicant: "Bewerber",
		appliedOn: "Beworben am",
		sessionLimit: "Sitzungslimit",
		approve: "Genehmigen",
		deny: "Ablehnen",
		approved: "Genehmigt",
		denied: "Abgelehnt",
		sessions: "Sitzungen",
		activeSessionsLimit: "Aktive Sitzungen: {current} / {limit}",
		unlimitedSessions: "Unbegrenzte Sitzungen",
		organization: "Organisation",
		organizationPlaceholder: "z.B. 'Stadtverwaltung' oder 'Mein Verein'",
		requestedSessions: "Anzahl der Sitzungen, die Sie erstellen möchten",
		requestedSessionsHelp: "Geben Sie ein, wie viele Sitzungen Sie voraussichtlich benötigen (1-50)",
		sessionManagement: "Sitzungsverwaltung",
		sessionsMovedMessage: "Die Sitzungsverwaltung wurde auf eine eigene Seite verschoben, um bessere Organisation und Zugänglichkeit zu ermöglichen.",
		goToManageSessions: "Zu Sitzungen verwalten",
	},

	// Manage Sessions
	manageSessions: {
		title: "Sitzungen verwalten",
		subtitle: "Demokratie-Sitzungen erstellen und verwalten",
	},

	// Phases
	phases: {
		phase1: "Phase 1",
		phase2: "Phase 2",
		rating: "Bewertung",
		debateAndVoting: "Debatte und Abstimmung",
		closed: "Geschlossen",
		transitionToDebate: "Übergang zu Debatte und Abstimmung in",
		transitionMessage:
			"Die Vorschläge wurden bewertet und wechseln bald zu Debatte und Abstimmung.",
		ideaPhaseComplete: "Die Ideenphase ist abgeschlossen!",
		nowToDebateAndVoting: "Jetzt zur Debatte und Abstimmung",
	},

	// Proposals
	proposals: {
		proposeNewIdea: "Neue Idee vorschlagen",
		noActiveSession: "Keine aktive Sitzung",
		topProposals: "Top-Vorschläge",
		allProposals: "Alle Vorschläge",
		noProposals:
			"Noch keine Vorschläge. Fügen Sie gerne erst alle Vorschläge hinzu, dann geben wir ihnen Sterne!",
		noTopProposals: "Noch keine Top-Vorschläge.",
		discussAndVote:
			"Diskutieren und abstimmen Sie über die beliebtesten Ideen",
		clickToDebateAndVote:
			"Klicken Sie auf einen Vorschlag, um Argumente zu sehen und zu diskutieren. Wenn die Debatte abgeschlossen ist, wählen Sie eine Frage, über die Sie abstimmen möchten.",
		debate: "Debattieren",
		debateTopProposals: "Top-Vorschläge debattieren",
		selectToDebate: "Wählen Sie einen Vorschlag zum Debattieren",
		selectForOrAgainst:
			"Wählen Sie, ob Sie dafür oder dagegen argumentieren möchten",
		cost: "Kosten",
		vote: "Abstimmen",
		title: "Titel",
		problem: "Problem:",
		problemColon: "Problem:",
		solution: "Lösung:",
		solutionColon: "Lösung:",
		estimatedCost: "Kosten/Nutzen:",
		author: "Autor",
		howToImprove: "Was möchten Sie fragen über",
		howToImproveYourSpace: "Was möchten Sie fragen?",
		count: "({count})",
		allProposalsCount: "Alle Vorschläge ({count})",
		topProposalsCount: "Top-Vorschläge ({count})",
		lockTop3: "Top 3 sperren und Debatte beginnen",
		yourProposal: "Ihr Vorschlag",
	},

	// Rating
	rating: {
		giveRating: "Bewertung abgeben",
		changeRating: "Bewertung ändern",
		clickStar: "Auf einen Stern klicken",
		ratingRegistered: "Bewertung {rating} registriert!",
		yourRating: "Ihre Bewertung",
	},

	// Comments
	comments: {
		showArguments: "Argumente anzeigen",
		hide: "Verbergen",
		writeArgument: "Schreiben Sie ein Argument...",
		writeComment: "Schreiben Sie einen Kommentar...",
		send: "Senden",
		sending: "Senden...",
		neutral: "Neutral",
		for: "Dafür",
		against: "Dagegen",
		noArgumentsYet: "Noch keine Argumente. Seien Sie der Erste!",
		noCommentsYet:
			"Noch keine Kommentare. Seien Sie der Erste, der diskutiert!",
		noForArgumentsYet: "Noch keine Argumente dafür.",
		noAgainstArgumentsYet: "Noch keine Argumente dagegen.",
		forArguments: "Argumente dafür",
		againstArguments: "Argumente dagegen",
		loading: "Argumente werden geladen...",
		loadingComments: "Kommentare werden geladen...",
		discussion: "Diskussion",
		all: "Alle",
		writeFor: "Schreiben Sie Argumente dafür...",
		writeAgainst: "Schreiben Sie Argumente dagegen...",
		previousFor: "Vorherige Argumente dafür",
		previousAgainst: "Vorherige Argumente dagegen",
		yourComment: "Ihr Argument",
	},

	// Voting
	voting: {
		vote: "Abstimmen",
		votingClosed: "Die Abstimmung ist abgeschlossen",
		weHaveResult: "Wir haben ein Ergebnis:",
		noMajority: "Kein Vorschlag erhielt eine Mehrheit bei der Abstimmung.",
		thanksForParticipation: "Vielen Dank für Ihre Teilnahme!",
		youHaveVotedProposal: "Sie haben für diesen Vorschlag gestimmt",
		alreadyUsedVote: "Sie haben Ihre Stimme bereits genutzt",
		limitedVotingRights:
			"Eingeschränktes Stimmrecht",
		oneVotePerSession:
			"Sie haben das Recht, nur für oder gegen einen (1) Vorschlag zu stimmen.",
		votingAdvantages:
			"Priorisierung verleiht Ihrer Stimme mehr Gewicht. Wählen Sie sorgfältig.",
		thanksForVote: "Vielen Dank für Ihre Stimme!",
		sessionClosesWhen:
			"Die Abstimmung endet, wenn alle abgestimmt haben oder das Zeitlimit erreicht ist.",
		viewYourVote: "Ihre Stimme ansehen",
		voteOnTopProposals: "Über Top-Vorschläge abstimmen",
		chooseIdeasToImplement:
			"Wählen Sie aus, welche Ideen umgesetzt werden sollen",
		yes: "JA",
		no: "NEIN",
		yesShort: "Ja",
		noShort: "Nein",
		results: "Ergebnisse",
		votesCount: "{count} Stimmen",
		youHaveVoted: "Sie haben abgestimmt",
		result: "Ergebnis",
		votes: "Stimmen",
		youVoted: "Sie haben abgestimmt",
		officialVoting: "Offizielle Abstimmung",
		yourVoteMatters: "Ihre Stimme zählt für die Demokratie",
		noProposals: "Keine Vorschläge zur Abstimmung",
		proposalXOfY: "Vorschlag {current} von {total}",
		castYourVote: "Geben Sie Ihre Stimme ab",
		yesVotes: "JA-Stimmen",
		noVotes: "NEIN-Stimmen",
		totalVotes: "{count} Stimmen insgesamt",
		nextProposal: "Nächster Vorschlag",
		previous: "Zurück",
		next: "Weiter",
	},

	// Create proposal
	createProposal: {
		title: "Neue Idee vorschlagen",
		nameOfProposal: "Name Ihres Vorschlags *",
		nameExample: "Z.B. 'Mehr Radwege im Zentrum'",
		problemLabel: "Was ist das Problem? *",
		problemPlaceholder:
			"Beschreiben Sie, welches Problem dieser Vorschlag löst...",
		solutionLabel: "Wie sieht die Lösung aus? *",
		solutionPlaceholder: "Beschreiben Sie Ihre Lösung im Detail...",
		costLabel: "Geschätzte Kosten *",
		costPlaceholder:
			"Z.B. '100 000 €', 'Geringe Kosten', 'Keine zusätzlichen Kosten'",
		submit: "Vorschlag senden",
		submitting: "Senden...",
		error: "Beim Erstellen des Vorschlags ist ein Fehler aufgetreten",
	},

	// Sessions
	sessions: {
		selectSession: "Wählen Sie eine Sitzung zur Teilnahme",
		noActiveSessions: "Keine aktiven Sitzungen",
		checkBackLater: "Kommen Sie später zurück oder kontaktieren Sie einen Administrator, um eine Sitzung zu erstellen.",
		activeUsers: "aktiv",
	},

	// Survey sessions (legacy)
	survey: {
		addResponse: "Fügen Sie Ihre Antwort hinzu",
		liveRankings: "Live-Rangliste",
		noResponses: "Noch keine Antworten. Seien Sie der Erste!",
		ratings: "Bewertungen",
		timeRemaining: "Verbleibende Zeit",
		resultsArchived: "Ergebnisse werden nach Ablauf archiviert",
		surveyEnded: "Umfrage beendet",
	},

	// Ranking sessions
	ranking: {
		addResponse: "Fügen Sie Ihre Antwort hinzu",
		liveRankings: "Live-Rangliste",
		noResponses: "Noch keine Antworten. Seien Sie der Erste!",
		ratings: "Bewertungen",
		timeRemaining: "Verbleibende Zeit",
		resultsArchived: "Ergebnisse werden nach Ablauf archiviert",
		rankingEnded: "Rangliste beendet",
	},

	// Archive
	archive: {
		archivedSurveys: "Archivierte Umfragen",
		archivedRankings: "Archivierte Ranglisten",
		archived: "Archiviert",
		participants: "Teilnehmer",
		notFound: "Archivierte Sitzung nicht gefunden",
		topResponse: "Beste Antwort",
		finalRankings: "Endrangliste",
		noResponses: "Für diese Rangliste wurden keine Antworten eingereicht.",
	},

	// Poll
	poll: {
		poll: "Umfrage",
		noActivePoll: "Keine aktive Umfrage",
		checkBackLater: "Derzeit ist keine Umfrage verfügbar. Bitte schauen Sie später wieder vorbei.",
		yourVote: "Ihre Stimme",
		votes: "Stimmen",
		totalVotes: "Stimmen insgesamt",
		selectToSeeResults: "Wählen Sie eine Option und senden Sie ab, um die Ergebnisse zu sehen",
		refreshResults: "Ergebnisse aktualisieren",
		submitting: "Wird gesendet...",
		updateVote: "Stimme ändern",
		submitVote: "Stimme abgeben",
		canChangeVote: "Sie können Ihre Stimme jederzeit ändern, solange die Umfrage aktiv ist.",
	},

	// Errors
	errors: {
		generic: "Ein Fehler ist aufgetreten",
		votingError: "Beim Abstimmen ist ein Fehler aufgetreten",
		unauthorized: "Sie müssen angemeldet sein",
		forbidden: "Sie haben keine Berechtigung",
		alreadySubmittedProposal: "Sie haben bereits einen Vorschlag in dieser Sitzung eingereicht.",
	},

	// Login page
	login: {
		subtitle: "Anmelden ohne Passwort",
		email: "E-Mail",
		emailPlaceholder: "ihre@email.de",
		sendCode: "Code senden",
		sending: "Senden...",
		codeSent: "Code gesendet! Überprüfen Sie Ihre E-Mail.",
		couldNotSendCode: "Code konnte nicht gesendet werden",
		code: "Code (6 Ziffern)",
		codeSentTo: "Wir haben den Code gesendet an",
		verifying: "Verifizieren...",
		login: "Anmelden",
		loginError: "Anmeldefehler",
		resendCode: "Code erneut senden",
		resendIn: "Erneut senden in {seconds}s",
		changeEmail: "E-Mail-Adresse ändern",
		newHere: "Neu hier?",
		createAccount: "Konto erstellen",
		aboutLink: "Über Gleichberechtigte Demokratie",
	},

	// About page
	about: {
		title: "Über Gleichberechtigte Demokratie",
		subtitle: "Ein demokratisches Werkzeug für Bürgerbeteiligung",
		whatIs: "Was ist Gleichberechtigte Demokratie?",
		introduction:
			"Gleichberechtigte Demokratie ist eine Plattform für demokratische Entscheidungsfindung, bei der alle Bürger gleichberechtigt mitbestimmen. Das System verwendet eingeschränkte Stimmrechte und algorithmisches Ranking, um sicherzustellen, dass die besten Ideen nach vorne kommen.",
		howItWorks: "Wie funktioniert es?",
		phase1Title: "Phase 1: Ideengenerierung und Bewertung",
		phase1Description:
			"Bürger schlagen Ideen vor und bewerten die Vorschläge anderer. Die besten Ideen kommen in die nächste Phase.",
		phase2Title: "Phase 2: Debatte und Abstimmung",
		phase2Description:
			"Die besten Vorschläge werden diskutiert. Bürger können Argumente dafür und dagegen vorbringen und die Argumente anderer bewerten. Schließlich stimmen alle über einen Vorschlag ab.",
		phase3Title: "Phase 3: Ergebnisse",
		phase3Description:
			"Der Siegervorschlag mit Mehrheitsunterstützung wird präsentiert und kann umgesetzt werden.",
		keyFeatures: "Hauptmerkmale",
		feature1:
			"Eingeschränktes Stimmrecht: Jeder Bürger hat eine Stimme pro Sitzung",
		feature2:
			"Algorithmisches Ranking: Die besten Ideen werden automatisch sortiert",
		feature3:
			"Transparenter Prozess: Alle Debatten und Stimmen sind sichtbar",
		feature4:
			"Anonyme Teilnahme: Schützen Sie Ihre Identität bei der Teilnahme",
		feature5:
			"Mehrsprachige Unterstützung: Verfügbar auf Schwedisch, Englisch, Deutsch, Spanisch und Serbisch",
		getInvolved: "Machen Sie mit!",
		getInvolvedDescription:
			"Treten Sie unserer demokratischen Gemeinschaft bei und lassen Sie Ihre Stimme hören. Gemeinsam können wir bessere Entscheidungen treffen.",
		joinNow: "Jetzt beitreten",
	},

	// Email
	email: {
		loginCode: {
			subject: "Ihr einmaliger Anmeldecode",
			yourCode: "Ihr Code lautet: {code}",
			codeValid:
				"Dieser Code ist 10 Minuten lang gültig. Falls Sie diesen Code nicht angefordert haben, können Sie diese E-Mail ignorieren.",
			title: "Ihr Anmeldecode",
			useCodeBelow:
				"Verwenden Sie den untenstehenden Code, um sich anzumelden. Er ist 10 Minuten lang gültig.",
			ignoreIfNotRequested:
				"Falls Sie diesen Code nicht angefordert haben, können Sie diese Nachricht ignorieren.",
		},
		sessionResults: {
			subject: "Vielen Dank für Ihre Teilnahme in {place}s Sitzung",
			thankYou:
				"Vielen Dank, dass Sie mitgemacht und die Demokratie entwickelt haben!",
			session: "{place}s Sitzung",
			proposalsVotedThrough:
				"Diese Vorschläge wurden durchgestimmt:",
			noMajority:
				"Leider erhielt dieses Mal kein Vorschlag eine Mehrheit.",
			yesVotes: "Ja-Stimmen",
			noVotes: "Nein-Stimmen",
			electionPromise:
				"Wenn wir die Wahl gewinnen, versprechen wir, diese Vorschläge voranzutreiben und die Möglichkeit zu bieten, die Lokalpolitik auf einem ganz neuen Niveau zu beeinflussen.",
			bestRegards: "Mit freundlichen Grüßen",
		},
		broadcast: {
			bestRegards: "Mit freundlichen Grüßen",
		},
		adminApplication: {
			subject: "Neue Admin-Bewerbung",
			newApplication:
				"Ein neuer Benutzer hat sich als Admin beworben.",
			applicantName: "Name",
			applicantEmail: "E-Mail",
			organization: "Organisation",
			requestedSessions: "Angeforderte Sitzungen",
			reviewPrompt:
				"Melden Sie sich im Admin-Panel an, um die Bewerbung zu prüfen und zu genehmigen/abzulehnen.",
			bestRegards: "Mit freundlichen Grüßen",
		},
		adminApproval: {
			subject: "Ihre Admin-Bewerbung wurde genehmigt",
			congratulations: "Herzlichen Glückwunsch {name}!",
			approved: "Ihre Bewerbung als Admin wurde genehmigt.",
			sessionLimit: "Sie können bis zu {limit} Sitzungen erstellen.",
			accessInstructions:
				"Melden Sie sich auf der Plattform an, um auf das Admin-Panel zuzugreifen und Sitzungen zu erstellen.",
			bestRegards: "Mit freundlichen Grüßen",
		},
		adminDenial: {
			subject: "Ihre Admin-Bewerbung wurde abgelehnt",
			greeting: "Hallo {name},",
			denied:
				"Leider wurde Ihre Bewerbung als Admin abgelehnt.",
			explanation:
				"Vielen Dank für Ihr Interesse, Admin zu werden. Nach Prüfung haben wir beschlossen, Ihre Bewerbung derzeit nicht zu genehmigen.",
			reapplyInstructions:
				"Sie können sich in 30 Tagen erneut bewerben, falls Sie weiterhin interessiert sind.",
			bestRegards: "Mit freundlichen Grüßen",
		},
		unsubscribe: {
			text: "Sie erhalten diese E-Mail, weil Sie ein Konto bei Equal Democracy haben.",
			linkText: "E-Mails abbestellen",
		},
	},
};
