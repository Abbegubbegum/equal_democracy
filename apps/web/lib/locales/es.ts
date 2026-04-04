/**
 * Spanish translations for Equal Democracy
 */

export const es = {
	// App name
	appName: "Democracia Igualitaria",

	// Common
	common: {
		loading: "Cargando...",
		save: "Guardar",
		cancel: "Cancelar",
		close: "Cerrar",
		back: "Atrás",
		backToHome: "Volver al inicio",
		backToStart: "Volver al inicio",
		next: "Siguiente",
		submit: "Enviar",
		delete: "Eliminar",
		edit: "Editar",
		yes: "Sí",
		no: "No",
		search: "Buscar",
		filter: "Filtrar",
		seconds: "segundos",
	},

	// Authentication
	auth: {
		login: "Iniciar sesión",
		logout: "Cerrar sesión",
		register: "Registrarse",
		email: "Correo electrónico",
		password: "Contraseña",
		name: "Nombre",
		requestCode: "Solicitar código",
		enterCode: "Ingresar código",
		hello: "Hola",
	},

	// Navigation
	nav: {
		admin: "Administración",
		home: "Inicio",
		applyForAdmin: "Solicitar admin",
		manageSessions: "Gestionar sesiones",
	},

	// Admin
	admin: {
		applyForAdmin: "Solicitar ser admin",
		applicationSubmitted:
			"Su solicitud ha sido enviada. Un superadmin la revisará en breve.",
		alreadyAdmin: "Ya tiene privilegios de administrador",
		pendingApplication: "Ya tiene una solicitud de admin pendiente",
		applicationDenied:
			"Su solicitud anterior fue denegada. Espere 30 días antes de volver a solicitar.",
		superadminPanel: "Panel de Superadmin",
		adminApplications: "Solicitudes de Admin",
		noPendingApplications: "No hay solicitudes pendientes",
		applicant: "Solicitante",
		appliedOn: "Solicitado el",
		sessionLimit: "Límite de sesiones",
		approve: "Aprobar",
		deny: "Denegar",
		approved: "Aprobado",
		denied: "Denegado",
		sessions: "Sesiones",
		activeSessionsLimit: "Sesiones activas: {current} / {limit}",
		unlimitedSessions: "Sesiones ilimitadas",
		organization: "Organización",
		organizationPlaceholder: "ej. 'Ayuntamiento' o 'Mi Asociación'",
		requestedSessions: "Número de sesiones que desea crear",
		requestedSessionsHelp: "Ingrese cuántas sesiones espera necesitar (1-50)",
		sessionManagement: "Gestión de sesiones",
		sessionsMovedMessage: "La gestión de sesiones se ha trasladado a una página dedicada para una mejor organización y accesibilidad.",
		goToManageSessions: "Ir a Gestionar sesiones",
	},

	// Manage Sessions
	manageSessions: {
		title: "Gestionar sesiones",
		subtitle: "Crear y gestionar sesiones democráticas",
	},

	// Phases
	phases: {
		phase1: "Fase 1",
		phase2: "Fase 2",
		rating: "Calificación",
		debateAndVoting: "Debate y Votación",
		closed: "Cerrado",
		transitionToDebate: "Transición al Debate y Votación en",
		transitionMessage:
			"Las propuestas han sido clasificadas y pronto pasarán al debate y votación.",
		ideaPhaseComplete: "¡La fase de ideas está completa!",
		nowToDebateAndVoting: "Ahora al debate y votación",
	},

	// Proposals
	proposals: {
		proposeNewIdea: "Proponer una nueva idea",
		noActiveSession: "No hay sesión activa",
		topProposals: "Mejores propuestas",
		allProposals: "Todas las propuestas",
		noProposals: "Aún no hay propuestas. ¡Siéntete libre de agregar todas las propuestas primero, luego les daremos estrellas!",
		noTopProposals: "Aún no hay mejores propuestas.",
		discussAndVote: "Discute y vota sobre las ideas más populares",
		clickToDebateAndVote:
			"Haz clic en una propuesta para ver argumentos y discutir. Cuando el debate esté completo, elige una pregunta para emitir tu voto.",
		debate: "Debatir",
		debateTopProposals: "Debatir las Mejores Propuestas",
		selectToDebate: "Selecciona una propuesta para debatir",
		selectForOrAgainst: "Elige si quieres argumentar a favor o en contra",
		cost: "Costo",
		vote: "Votar",
		title: "Título",
		problem: "Problema:",
		problemColon: "Problema:",
		solution: "Solución:",
		solutionColon: "Solución:",
		estimatedCost: "Costo/Beneficio:",
		author: "Autor",
		howToImprove: "Qué quieres preguntar sobre",
		howToImproveYourSpace: "¿Qué quieres preguntar?",
		count: "({count})",
		allProposalsCount: "Todas las propuestas ({count})",
		topProposalsCount: "Mejores propuestas ({count})",
		lockTop3: "Bloquear las 3 mejores y comenzar a debatir",
		yourProposal: "Tu propuesta",
	},

	// Rating
	rating: {
		giveRating: "Dar calificación",
		changeRating: "Cambiar calificación",
		clickStar: "Haz clic en una estrella",
		ratingRegistered: "¡Calificación {rating} registrada!",
		yourRating: "Tu calificación",
	},

	// Comments
	comments: {
		showArguments: "Mostrar argumentos",
		hide: "Ocultar",
		writeArgument: "Escribe un argumento...",
		writeComment: "Escribe un comentario...",
		send: "Enviar",
		sending: "Enviando...",
		neutral: "Neutral",
		for: "A favor",
		against: "En contra",
		noArgumentsYet: "Aún no hay argumentos. ¡Sé el primero!",
		noCommentsYet: "Aún no hay comentarios. ¡Sé el primero en discutir!",
		noForArgumentsYet: "Aún no hay argumentos a favor.",
		noAgainstArgumentsYet: "Aún no hay argumentos en contra.",
		forArguments: "Argumentos a favor",
		againstArguments: "Argumentos en contra",
		loading: "Cargando argumentos...",
		loadingComments: "Cargando comentarios...",
		discussion: "Discusión",
		all: "Todos",
		writeFor: "Escribe argumentos a favor...",
		writeAgainst: "Escribe argumentos en contra...",
		previousFor: "Argumentos anteriores a favor",
		previousAgainst: "Argumentos anteriores en contra",
		yourComment: "Tu argumento",
	},

	// Voting
	voting: {
		vote: "Votar",
		votingClosed: "La votación ha terminado",
		weHaveResult: "Tenemos un resultado:",
		noMajority: "Ninguna propuesta obtuvo mayoría en la votación.",
		thanksForParticipation: "¡Gracias por tu participación!",
		youHaveVotedProposal: "Has votado por esta propuesta",
		alreadyUsedVote: "Ya has usado tu voto",
		limitedVotingRights:
			"Derecho de voto limitado",
		oneVotePerSession:
			"Tienes derecho a votar a favor o en contra de solo una (1) propuesta.",
		votingAdvantages:
			"La priorización le da mayor peso a tu voto. Elige con cuidado.",
		thanksForVote: "¡Gracias por tu voto!",
		sessionClosesWhen:
			"La votación termina cuando todos han votado o se alcanza el límite de tiempo.",
		viewYourVote: "Ver tu voto",
		voteOnTopProposals: "Vota por las Mejores Propuestas",
		chooseIdeasToImplement: "Elige qué ideas implementar",
		yes: "SÍ",
		no: "NO",
		yesShort: "Sí",
		noShort: "No",
		results: "Resultados",
		votesCount: "{count} votos",
		youHaveVoted: "Has votado",
		result: "Resultado",
		votes: "votos",
		youVoted: "Has votado",
		officialVoting: "Votación Oficial",
		yourVoteMatters: "Tu voto es importante para la democracia",
		noProposals: "No hay propuestas para votar",
		proposalXOfY: "Propuesta {current} de {total}",
		castYourVote: "Emite tu voto",
		yesVotes: "Votos SÍ",
		noVotes: "Votos NO",
		totalVotes: "{count} votos en total",
		nextProposal: "Siguiente propuesta",
		previous: "Anterior",
		next: "Siguiente",
	},

	// Create proposal
	createProposal: {
		title: "Proponer una nueva idea",
		nameOfProposal: "Nombre de tu propuesta *",
		nameExample: "Ej. 'Más carriles bici en el centro'",
		problemLabel: "¿Cuál es el problema? *",
		problemPlaceholder: "Describe qué problema resuelve esta propuesta...",
		solutionLabel: "¿Cómo es la solución? *",
		solutionPlaceholder: "Describe tu solución en detalle...",
		costLabel: "Costo estimado *",
		costPlaceholder: "Ej. '100 000 €', 'Bajo costo', 'Sin costo adicional'",
		submit: "Enviar propuesta",
		submitting: "Enviando...",
		error: "Ocurrió un error al crear la propuesta",
	},

	// Sessions
	sessions: {
		selectSession: "Selecciona una sesión para participar",
		noActiveSessions: "No hay sesiones activas",
		checkBackLater: "Vuelve más tarde o contacta a un administrador para crear una sesión.",
		activeUsers: "activos",
	},

	// Survey sessions (legacy)
	survey: {
		addResponse: "Añade tu respuesta",
		liveRankings: "Clasificación en vivo",
		noResponses: "Aún no hay respuestas. ¡Sé el primero en responder!",
		ratings: "valoraciones",
		timeRemaining: "Tiempo restante",
		resultsArchived: "Los resultados se archivarán cuando expire el tiempo",
		surveyEnded: "Encuesta finalizada",
	},

	// Ranking sessions
	ranking: {
		addResponse: "Añade tu respuesta",
		liveRankings: "Clasificación en vivo",
		noResponses: "Aún no hay respuestas. ¡Sé el primero en responder!",
		ratings: "valoraciones",
		timeRemaining: "Tiempo restante",
		resultsArchived: "Los resultados se archivarán cuando expire el tiempo",
		rankingEnded: "Clasificación finalizada",
	},

	// Archive
	archive: {
		archivedSurveys: "Encuestas archivadas",
		archivedRankings: "Clasificaciones archivadas",
		archived: "Archivada",
		participants: "participantes",
		notFound: "Sesión archivada no encontrada",
		topResponse: "Mejor respuesta",
		finalRankings: "Clasificación final",
		noResponses: "No se enviaron respuestas para esta clasificación.",
	},

	// Poll
	poll: {
		poll: "Encuesta",
		noActivePoll: "No hay encuesta activa",
		checkBackLater: "No hay ninguna encuesta disponible en este momento. Por favor, vuelve más tarde.",
		yourVote: "Tu voto",
		votes: "votos",
		totalVotes: "votos totales",
		selectToSeeResults: "Selecciona una opción y envía para ver los resultados",
		refreshResults: "Actualizar resultados",
		submitting: "Enviando...",
		updateVote: "Actualizar voto",
		submitVote: "Enviar voto",
		canChangeVote: "Puedes cambiar tu voto en cualquier momento mientras la encuesta esté activa.",
	},

	// Errors
	errors: {
		generic: "Ocurrió un error",
		votingError: "Ocurrió un error al votar",
		unauthorized: "Debes iniciar sesión",
		forbidden: "No tienes permiso",
		alreadySubmittedProposal: "Ya has enviado una propuesta en esta sesión.",
	},

	// Login page
	login: {
		subtitle: "Iniciar sesión sin contraseña",
		email: "Correo electrónico",
		emailPlaceholder: "tu@email.com",
		sendCode: "Enviar código",
		sending: "Enviando...",
		codeSent: "¡Código enviado! Revisa tu correo.",
		couldNotSendCode: "No se pudo enviar el código",
		code: "Código (6 dígitos)",
		codeSentTo: "Enviamos el código a",
		verifying: "Verificando...",
		login: "Iniciar sesión",
		loginError: "Error de inicio de sesión",
		resendCode: "Reenviar código",
		resendIn: "Reenviar en {seconds}s",
		changeEmail: "Cambiar dirección de correo",
		newHere: "¿Nuevo aquí?",
		createAccount: "Crear cuenta",
		aboutLink: "Acerca de Democracia Igualitaria",
	},

	// About page
	about: {
		title: "Acerca de Democracia Igualitaria",
		subtitle: "Una herramienta democrática para la participación ciudadana",
		whatIs: "¿Qué es Democracia Igualitaria?",
		introduction:
			"Democracia Igualitaria es una plataforma para la toma de decisiones democráticas donde todos los ciudadanos tienen la misma voz. El sistema utiliza derechos de voto limitados y clasificación algorítmica para asegurar que las mejores ideas surjan.",
		howItWorks: "¿Cómo funciona?",
		phase1Title: "Fase 1: Generación de Ideas y Calificación",
		phase1Description:
			"Los ciudadanos proponen ideas y califican las propuestas de otros. Las mejores ideas avanzan a la siguiente fase.",
		phase2Title: "Fase 2: Debate y Votación",
		phase2Description:
			"Las mejores propuestas se discuten. Los ciudadanos pueden presentar argumentos a favor y en contra, y calificar los argumentos de otros. Finalmente, todos votan sobre una propuesta.",
		phase3Title: "Fase 3: Resultados",
		phase3Description:
			"La propuesta ganadora con apoyo mayoritario se presenta y puede ser implementada.",
		keyFeatures: "Características Clave",
		feature1:
			"Derechos de voto limitados: Cada ciudadano tiene un voto por sesión",
		feature2:
			"Clasificación algorítmica: Las mejores ideas se ordenan automáticamente",
		feature3:
			"Proceso transparente: Todo el debate y los votos son visibles",
		feature4:
			"Participación anónima: Protege tu identidad mientras participas",
		feature5:
			"Soporte multilingüe: Disponible en sueco, inglés, alemán, español y serbio",
		getInvolved: "¡Involúcrate!",
		getInvolvedDescription:
			"Únete a nuestra comunidad democrática y haz oír tu voz. Juntos podemos tomar mejores decisiones.",
		joinNow: "Únete Ahora",
	},

	// Email
	email: {
		loginCode: {
			subject: "Tu código de inicio de sesión único",
			yourCode: "Tu código es: {code}",
			codeValid:
				"Este código es válido durante 10 minutos. Si no solicitaste este código, puedes ignorar este correo electrónico.",
			title: "Tu código de inicio de sesión",
			useCodeBelow:
				"Usa el código a continuación para iniciar sesión. Es válido durante 10 minutos.",
			ignoreIfNotRequested:
				"Si no solicitaste este código, puedes ignorar este mensaje.",
		},
		sessionResults: {
			subject: "Gracias por tu participación en la sesión de {place}",
			thankYou: "¡Gracias por participar y desarrollar la democracia!",
			session: "Sesión de {place}",
			proposalsVotedThrough: "Estas propuestas fueron aprobadas:",
			noMajority:
				"Desafortunadamente, ninguna propuesta obtuvo mayoría esta vez.",
			yesVotes: "votos sí",
			noVotes: "votos no",
			electionPromise:
				"Si ganamos las elecciones, prometemos impulsar estas propuestas y brindar la oportunidad de influir en la política local a un nivel completamente nuevo.",
			bestRegards: "Saludos cordiales",
		},
		broadcast: {
			bestRegards: "Saludos cordiales",
		},
		adminApplication: {
			subject: "Nueva Solicitud de Administrador",
			newApplication:
				"Un nuevo usuario ha solicitado convertirse en administrador.",
			applicantName: "Nombre",
			applicantEmail: "Correo electrónico",
			organization: "Organización",
			requestedSessions: "Sesiones Solicitadas",
			reviewPrompt:
				"Inicia sesión en el panel de administración para revisar y aprobar/rechazar la solicitud.",
			bestRegards: "Saludos cordiales",
		},
		adminApproval: {
			subject: "Tu Solicitud de Administrador Ha Sido Aprobada",
			congratulations: "¡Felicitaciones {name}!",
			approved:
				"Tu solicitud para convertirte en administrador ha sido aprobada.",
			sessionLimit: "Puedes crear hasta {limit} sesiones.",
			accessInstructions:
				"Inicia sesión en la plataforma para acceder al panel de administración y comenzar a crear sesiones.",
			bestRegards: "Saludos cordiales",
		},
		adminDenial: {
			subject: "Tu Solicitud de Administrador Ha Sido Rechazada",
			greeting: "Hola {name},",
			denied:
				"Lamentablemente, tu solicitud para convertirte en administrador ha sido rechazada.",
			explanation:
				"Gracias por tu interés en convertirte en administrador. Después de la revisión, hemos decidido no aprobar tu solicitud en este momento.",
			reapplyInstructions:
				"Puedes volver a solicitarlo en 30 días si sigues interesado.",
			bestRegards: "Saludos cordiales",
		},
		unsubscribe: {
			text: "Recibes este correo electrónico porque tienes una cuenta en Equal Democracy.",
			linkText: "Cancelar suscripción de correos",
		},
	},
};
