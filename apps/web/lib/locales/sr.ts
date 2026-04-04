/**
 * Serbian translations for Equal Democracy
 */

export const sr = {
	// App name
	appName: "Jednaka Demokratija",

	// Common
	common: {
		loading: "Učitavanje...",
		save: "Sačuvaj",
		cancel: "Otkaži",
		close: "Zatvori",
		back: "Nazad",
		backToHome: "Nazad na početnu stranicu",
		backToStart: "Nazad na početak",
		next: "Sledeće",
		submit: "Pošalji",
		delete: "Obriši",
		edit: "Uredi",
		yes: "Da",
		no: "Ne",
		search: "Pretraži",
		filter: "Filtriraj",
		seconds: "sekundi",
	},

	// Authentication
	auth: {
		login: "Prijavite se",
		logout: "Odjavite se",
		register: "Registrujte se",
		email: "E-pošta",
		password: "Lozinka",
		name: "Ime",
		requestCode: "Zatraži kod",
		enterCode: "Unesite kod",
		hello: "Zdravo",
	},

	// Navigation
	nav: {
		admin: "Administracija",
		home: "Početna",
		applyForAdmin: "Prijavi se za admina",
		manageSessions: "Upravljaj sesijama",
	},

	// Admin
	admin: {
		applyForAdmin: "Prijavi se da postaneš admin",
		applicationSubmitted:
			"Vaša prijava je poslata. Superadmin će je uskoro pregledati.",
		alreadyAdmin: "Već imate administratorske privilegije",
		pendingApplication: "Već imate prijavu na čekanju",
		applicationDenied:
			"Vaša prethodna prijava je odbijena. Sačekajte 30 dana pre ponovne prijave.",
		superadminPanel: "Superadmin Panel",
		adminApplications: "Admin prijave",
		noPendingApplications: "Nema prijava na čekanju",
		applicant: "Podnosilac",
		appliedOn: "Prijavljeno",
		sessionLimit: "Limit sesija",
		approve: "Odobri",
		deny: "Odbij",
		approved: "Odobreno",
		denied: "Odbijeno",
		sessions: "Sesije",
		activeSessionsLimit: "Aktivne sesije: {current} / {limit}",
		unlimitedSessions: "Neograničene sesije",
		organization: "Organizacija",
		organizationPlaceholder: "npr. 'Gradsko veće' ili 'Moje udruženje'",
		requestedSessions: "Broj sesija koje želite da kreirate",
		requestedSessionsHelp: "Unesite koliko sesija očekujete da će vam biti potrebno (1-50)",
		sessionManagement: "Upravljanje sesijama",
		sessionsMovedMessage: "Upravljanje sesijama je premešteno na posebnu stranicu radi bolje organizacije i pristupačnosti.",
		goToManageSessions: "Idi na Upravljanje sesijama",
	},

	// Manage Sessions
	manageSessions: {
		title: "Upravljaj sesijama",
		subtitle: "Kreiraj i upravljaj demokratskim sesijama",
	},

	// Phases
	phases: {
		phase1: "Faza 1",
		phase2: "Faza 2",
		rating: "Ocenjivanje",
		debateAndVoting: "Debata i Glasanje",
		closed: "Završeno",
		transitionToDebate: "Prelazak na Debatu i Glasanje za",
		transitionMessage:
			"Predlozi su rangirani i uskoro prelaze na debatu i glasanje.",
		ideaPhaseComplete: "Faza ideja je završena!",
		nowToDebateAndVoting: "Sada na debatu i glasanje",
	},

	// Proposals
	proposals: {
		proposeNewIdea: "Predloži novu ideju",
		noActiveSession: "Nema aktivne sesije",
		topProposals: "Top predlozi",
		allProposals: "Svi predlozi",
		noProposals: "Još nema predloga. Slobodno dodajte sve predloge prvo, pa ćemo im onda dati zvezde!",
		noTopProposals: "Još nema top predloga.",
		discussAndVote: "Raspravljajte i glasajte o najpopularnijim idejama",
		clickToDebateAndVote:
			"Kliknite na predlog da vidite argumente i raspravljate. Kada se debata završi, izaberite pitanje za koje želite da glasate.",
		debate: "Debatuj",
		debateTopProposals: "Debatujte o Top predlozima",
		selectToDebate: "Izaberite predlog za raspravu",
		selectForOrAgainst:
			"Izaberite da li želite da argumentujete za ili protiv",
		cost: "Trošak",
		vote: "Glasaj",
		title: "Naslov",
		problem: "Problem:",
		problemColon: "Problem:",
		solution: "Rešenje:",
		solutionColon: "Rešenje:",
		estimatedCost: "Trošak/Korist:",
		author: "Autor",
		howToImprove: "Šta želite da pitate o",
		howToImproveYourSpace: "Šta želite da pitate?",
		count: "({count})",
		allProposalsCount: "Svi predlozi ({count})",
		topProposalsCount: "Top predlozi ({count})",
		lockTop3: "Zaključajte top 3 i počnite raspravu",
		yourProposal: "Vaš predlog",
	},

	// Rating
	rating: {
		giveRating: "Dajte ocenu",
		changeRating: "Promenite ocenu",
		clickStar: "Kliknite na zvezdu",
		ratingRegistered: "Ocena {rating} registrovana!",
		yourRating: "Vaša ocena",
	},

	// Comments
	comments: {
		showArguments: "Prikaži argumente",
		hide: "Sakrij",
		writeArgument: "Napišite argument...",
		writeComment: "Napišite komentar...",
		send: "Pošalji",
		sending: "Slanje...",
		neutral: "Neutralno",
		for: "Za",
		against: "Protiv",
		noArgumentsYet: "Još nema argumenata. Budite prvi!",
		noCommentsYet: "Još nema komentara. Budite prvi koji će diskutovati!",
		noForArgumentsYet: "Još nema argumenata za.",
		noAgainstArgumentsYet: "Još nema argumenata protiv.",
		forArguments: "Argumenti za",
		againstArguments: "Argumenti protiv",
		loading: "Učitavanje argumenata...",
		loadingComments: "Učitavanje komentara...",
		discussion: "Diskusija",
		all: "Sve",
		writeFor: "Napišite argumente za...",
		writeAgainst: "Napišite argumente protiv...",
		previousFor: "Prethodni argumenti za",
		previousAgainst: "Prethodni argumenti protiv",
		yourComment: "Vaš argument",
	},

	// Voting
	voting: {
		vote: "Glasaj",
		votingClosed: "Glasanje je završeno",
		weHaveResult: "Imamo rezultat:",
		noMajority: "Nijedan predlog nije dobio većinu u glasanju.",
		thanksForParticipation: "Hvala na učešću!",
		youHaveVotedProposal: "Glasali ste za ovaj predlog",
		alreadyUsedVote: "Već ste iskoristili svoj glas",
		limitedVotingRights: "Ograničeno pravo glasa",
		oneVotePerSession:
			"Imate pravo da glasate za ili protiv samo jednog (1) predloga.",
		votingAdvantages:
			"Prioritizacija daje vašem glasu veću težinu. Birajte pažljivo.",
		thanksForVote: "Hvala na vašem glasu!",
		sessionClosesWhen:
			"Glasanje se završava kada svi glasaju ili se dostigne vremensko ograničenje.",
		viewYourVote: "Pogledaj svoj glas",
		voteOnTopProposals: "Glasajte za Top predloge",
		chooseIdeasToImplement: "Izaberite koje ideje treba sprovesti",
		yes: "DA",
		no: "NE",
		yesShort: "Da",
		noShort: "Ne",
		results: "Rezultati",
		votesCount: "{count} glasova",
		youHaveVoted: "Glasali ste",
		result: "Rezultat",
		votes: "glasova",
		youVoted: "Glasali ste",
		officialVoting: "Zvanično glasanje",
		yourVoteMatters: "Vaš glas je važan za demokratiju",
		noProposals: "Nema predloga za glasanje",
		proposalXOfY: "Predlog {current} od {total}",
		castYourVote: "Dajte svoj glas",
		yesVotes: "DA glasova",
		noVotes: "NE glasova",
		totalVotes: "{count} ukupno glasova",
		nextProposal: "Sledeći predlog",
		previous: "Prethodni",
		next: "Sledeći",
	},

	// Create proposal
	createProposal: {
		title: "Predloži novu ideju",
		nameOfProposal: "Naziv vašeg predloga *",
		nameExample: "Npr. 'Više biciklističkih staza u centru'",
		problemLabel: "Koji je problem? *",
		problemPlaceholder: "Opišite koji problem ovaj predlog rešava...",
		solutionLabel: "Kako izgleda rešenje? *",
		solutionPlaceholder: "Opišite svoje rešenje detaljno...",
		costLabel: "Procenjeni trošak *",
		costPlaceholder:
			"Npr. '100 000 RSD', 'Nizak trošak', 'Bez dodatnih troškova'",
		submit: "Pošalji predlog",
		submitting: "Slanje...",
		error: "Došlo je do greške prilikom kreiranja predloga",
	},

	// Sessions
	sessions: {
		selectSession: "Izaberite sesiju za učešće",
		noActiveSessions: "Nema aktivnih sesija",
		checkBackLater: "Vratite se kasnije ili kontaktirajte administratora da kreira sesiju.",
		activeUsers: "aktivnih",
	},

	// Survey sessions (legacy)
	survey: {
		addResponse: "Dodajte vaš odgovor",
		liveRankings: "Rangiranje uživo",
		noResponses: "Još nema odgovora. Budite prvi koji će odgovoriti!",
		ratings: "ocene",
		timeRemaining: "Preostalo vreme",
		resultsArchived: "Rezultati će biti arhivirani kada vreme istekne",
		surveyEnded: "Anketa je završena",
	},

	// Ranking sessions
	ranking: {
		addResponse: "Dodajte vaš odgovor",
		liveRankings: "Rangiranje uživo",
		noResponses: "Još nema odgovora. Budite prvi koji će odgovoriti!",
		ratings: "ocene",
		timeRemaining: "Preostalo vreme",
		resultsArchived: "Rezultati će biti arhivirani kada vreme istekne",
		rankingEnded: "Rangiranje je završeno",
	},

	// Archive
	archive: {
		archivedSurveys: "Arhivirane ankete",
		archivedRankings: "Arhivirana rangiranja",
		archived: "Arhivirano",
		participants: "učesnika",
		notFound: "Arhivirana sesija nije pronađena",
		topResponse: "Najbolji odgovor",
		finalRankings: "Konačna rangiranja",
		noResponses: "Za ovo rangiranje nisu dostavljeni odgovori.",
	},

	// Poll
	poll: {
		poll: "Anketa",
		noActivePoll: "Nema aktivne ankete",
		checkBackLater: "Trenutno nema dostupne ankete. Molimo proverite kasnije.",
		yourVote: "Vaš glas",
		votes: "glasova",
		totalVotes: "ukupno glasova",
		selectToSeeResults: "Izaberite opciju i pošaljite da vidite rezultate",
		refreshResults: "Osveži rezultate",
		submitting: "Slanje...",
		updateVote: "Ažuriraj glas",
		submitVote: "Pošalji glas",
		canChangeVote: "Možete promeniti svoj glas u bilo kom trenutku dok je anketa aktivna.",
	},

	// Errors
	errors: {
		generic: "Došlo je do greške",
		votingError: "Došlo je do greške prilikom glasanja",
		unauthorized: "Morate biti prijavljeni",
		forbidden: "Nemate ovlašćenje",
		alreadySubmittedProposal: "Već ste poslali predlog u ovoj sesiji.",
	},

	// Login page
	login: {
		subtitle: "Prijavite se bez lozinke",
		email: "Email",
		emailPlaceholder: "vas@email.com",
		sendCode: "Pošalji kod",
		sending: "Slanje...",
		codeSent: "Kod poslat! Proverite svoj email.",
		couldNotSendCode: "Nije moguće poslati kod",
		code: "Kod (6 cifara)",
		codeSentTo: "Poslali smo kod na",
		verifying: "Verifikacija...",
		login: "Prijavi se",
		loginError: "Greška pri prijavljivanju",
		resendCode: "Pošalji kod ponovo",
		resendIn: "Ponovo u {seconds}s",
		changeEmail: "Promeni email adresu",
		newHere: "Novi ste ovde?",
		createAccount: "Kreiraj nalog",
		aboutLink: "O Ravnopravnoj Demokratiji",
	},

	// About page
	about: {
		title: "O Ravnopravnoj Demokratiji",
		subtitle: "Demokratski alat za učešće građana",
		whatIs: "Šta je Ravnopravna Demokratija?",
		introduction:
			"Ravnopravna Demokratija je platforma za demokratsko donošenje odluka gde svi građani imaju jednak glas. Sistem koristi ograničena glasačka prava i algoritamsko rangiranje kako bi osigurao da najbolje ideje izađu na videlo.",
		howItWorks: "Kako funkcioniše?",
		phase1Title: "Faza 1: Generisanje Ideja i Ocenjivanje",
		phase1Description:
			"Građani predlažu ideje i ocenjuju predloge drugih. Najbolje ideje prelaze u sledeću fazu.",
		phase2Title: "Faza 2: Debata i Glasanje",
		phase2Description:
			"Najbolji predlozi se diskutuju. Građani mogu izneti argumente za i protiv, i oceniti argumente drugih. Na kraju, svi glasaju o jednom predlogu.",
		phase3Title: "Faza 3: Rezultati",
		phase3Description:
			"Pobednički predlog sa većinskom podrškom se predstavlja i može biti implementiran.",
		keyFeatures: "Ključne Karakteristike",
		feature1:
			"Ograničena glasačka prava: Svaki građanin ima jedan glas po sesiji",
		feature2:
			"Algoritamsko rangiranje: Najbolje ideje se automatski sortiraju",
		feature3: "Transparentan proces: Sve debate i glasovi su vidljivi",
		feature4: "Anonimno učešće: Zaštitite svoj identitet dok učestvujete",
		feature5:
			"Višejezična podrška: Dostupno na švedskom, engleskom, nemačkom, španskom i srpskom",
		getInvolved: "Uključite se!",
		getInvolvedDescription:
			"Pridružite se našoj demokratskoj zajednici i neka vaš glas bude čuven. Zajedno možemo donositi bolje odluke.",
		joinNow: "Pridruži se sada",
	},

	// Email
	email: {
		loginCode: {
			subject: "Vaš jednokratni kod za prijavu",
			yourCode: "Vaš kod je: {code}",
			codeValid:
				"Ovaj kod je važeći 10 minuta. Ako niste zatražili ovaj kod, možete ignorisati ovaj e-mail.",
			title: "Vaš kod za prijavu",
			useCodeBelow:
				"Koristite kod ispod da se prijavite. Važeći je 10 minuta.",
			ignoreIfNotRequested:
				"Ako niste zatražili ovaj kod, možete ignorisati ovu poruku.",
		},
		sessionResults: {
			subject: "Hvala na učešću u sesiji za {place}",
			thankYou: "Hvala što ste učestvovali i razvijali demokratiju!",
			session: "Sesija za {place}",
			proposalsVotedThrough: "Ovi predlozi su izglasani:",
			noMajority: "Nažalost, nijedan predlog nije dobio većinu ovaj put.",
			yesVotes: "DA glasova",
			noVotes: "NE glasova",
			electionPromise:
				"Ako pobedimo na izborima, obećavamo da ćemo promovisati ove predloge i pružiti mogućnost da utičete na lokalnu politiku na potpuno novom nivou.",
			bestRegards: "Srdačan pozdrav",
		},
		broadcast: {
			bestRegards: "Srdačan pozdrav",
		},
		adminApplication: {
			subject: "Nova prijava za administratora",
			newApplication:
				"Novi korisnik se prijavio da postane administrator.",
			applicantName: "Ime",
			applicantEmail: "E-mail",
			organization: "Organizacija",
			requestedSessions: "Tražene sesije",
			reviewPrompt:
				"Prijavite se na admin panel da pregledate i odobrite/odbijete prijavu.",
			bestRegards: "Srdačan pozdrav",
		},
		adminApproval: {
			subject: "Vaša prijava za administratora je odobrena",
			congratulations: "Čestitamo {name}!",
			approved: "Vaša prijava da postanete administrator je odobrena.",
			sessionLimit: "Možete kreirati do {limit} sesija.",
			accessInstructions:
				"Prijavite se na platformu da pristupite admin panelu i počnete sa kreiranjem sesija.",
			bestRegards: "Srdačan pozdrav",
		},
		adminDenial: {
			subject: "Vaša prijava za administratora je odbijena",
			greeting: "Zdravo {name},",
			denied: "Nažalost, vaša prijava da postanete administrator je odbijena.",
			explanation:
				"Hvala na vašem interesu da postanete administrator. Nakon pregleda, odlučili smo da trenutno ne odobrimo vašu prijavu.",
			reapplyInstructions:
				"Možete se ponovo prijaviti za 30 dana ako ste i dalje zainteresovani.",
			bestRegards: "Srdačan pozdrav",
		},
		unsubscribe: {
			text: "Primate ovu poruku jer imate nalog na Equal Democracy.",
			linkText: "Odjavite se od mejlova",
		},
	},
};
