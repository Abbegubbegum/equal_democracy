import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
	Users,
	Plus,
	ThumbsUp,
	ThumbsDown,
	MessageCircle,
	TrendingUp,
	Info,
	Clock,
	Star,
	ArrowLeft,
	ChevronRight,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";
import { useTranslation } from "../../lib/hooks/useTranslation";
import { useConfig } from "../../lib/contexts/ConfigContext";
import useSSE from "../../lib/hooks/useSSE";
import { useLazySound } from "../../lib/hooks/useLazySound";

// Standard session page - for 2-phase democracy sessions
// Survey sessions are handled by /session/survey/[id].js

// Helper function to format date and time consistently
function formatDateTime(dateString) {
	const date = new Date(dateString);
	const year = date.getFullYear().toString().slice(2);
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	return `${year}${month}${day}, ${hours}:${minutes}`;
}

export default function SessionPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { id: sessionId } = router.query;
	const { t } = useTranslation();
	const { theme, config } = useConfig();
	const [proposals, setProposals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState("home"); // 'home', 'create', 'vote'
	const [selectedProposal, setSelectedProposal] = useState(null);
	const [placeName, setPlaceName] = useState("");
	const [currentPhase, setCurrentPhase] = useState("phase1"); // 'phase1', 'phase2', 'closed'
	const [expandedRating, setExpandedRating] = useState(null);
	const [expandedProposal, setExpandedProposal] = useState(null);
	const [, setUserHasRated] = useState(false);
	const [showPhaseTransition, setShowPhaseTransition] = useState(false);
	const [showSessionClosed, setShowSessionClosed] = useState(false);
	const [winningProposals, setWinningProposals] = useState([]);
	const [transitionCountdown, setTransitionCountdown] = useState(null);
	const [terminationCountdown, setTerminationCountdown] = useState(null);
	const terminationIntervalRef = useRef(null);
	const terminationCountdownRef = useRef(null);
	const startTerminationCountdownRef = useRef(null);
	const [userHasVotedInSession, setUserHasVotedInSession] = useState(false);
	const [votedProposalId, setVotedProposalId] = useState(null);
	const [isInitialLoad, setIsInitialLoad] = useState(true);
	const [hasActiveSession, setHasActiveSession] = useState(true);
	const transitionIntervalRef = useRef(null);
	const [commentUpdateTrigger, setCommentUpdateTrigger] = useState(0);
	const [, setUserHasCreatedProposal] = useState(false);
	const [showUserCount, setShowUserCount] = useState(false);
	const [noMotivation, setNoMotivation] = useState(false);
	const [onlyYesVotes, setOnlyYesVotes] = useState(false);
	const [tiebreakerActive, setTiebreakerActive] = useState(false);
	const [tiebreakerProposalIds, setTiebreakerProposalIds] = useState([]);
	const [tiebreakerCountdown, setTiebreakerCountdown] = useState(null);
	const tiebreakerIntervalRef = useRef(null);
	const tiebreakerCountdownRef = useRef(null);
	const startTiebreakerCountdownRef = useRef(null);
	const [sessionTypeVerified, setSessionTypeVerified] = useState(false);

	// Sound effects (lazy-loaded to reduce initial bundle)
	const [playEndSign] = useLazySound("/sounds/end_sign.mp3", { volume: 0.5 });
	const [playNotification] = useLazySound("/sounds/notification.mp3", {
		volume: 0.5,
	});

	const fetchWinningProposals = useCallback(async () => {
		try {
			const res = await fetch(
				`/api/top-proposals?sessionId=${sessionId}`,
			);
			const data = await res.json();
			setWinningProposals(data);
		} catch (error) {
			console.error("Error fetching winning proposals:", error);
		}
	}, [sessionId]);

	const fetchProposals = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch(`/api/proposals?sessionId=${sessionId}`);
			const data = await res.json();
			setProposals(Array.isArray(data) ? data : []);
		} catch (error) {
			console.error("Error fetching proposals:", error);
			setProposals([]);
		} finally {
			setLoading(false);
		}
	}, [sessionId]);

	const fetchSessionInfo = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch(
				`/api/sessions/current?sessionId=${sessionId}`,
			);
			const data = await res.json();

			if (data.noActiveSession) {
				setHasActiveSession(false);
				setCurrentPhase(null);
				setPlaceName("");
				setLoading(false);
				setSessionTypeVerified(true);
				return;
			}

			setHasActiveSession(true);

			if (data.place) {
				setPlaceName(data.place);
			}

			if (data.showUserCount !== undefined) {
				setShowUserCount(data.showUserCount);
			}

			if (data.noMotivation !== undefined) {
				setNoMotivation(data.noMotivation);
			}

			if (data.onlyYesVotes !== undefined) {
				setOnlyYesVotes(data.onlyYesVotes);
			}

			// Pick up termination countdown if already scheduled (e.g. page reload)
			if (data.terminationSecondsRemaining > 0 && terminationCountdownRef.current === null && !data.tiebreakerActive) {
				startTerminationCountdownRef.current?.(data.terminationSecondsRemaining);
			}

			// Pick up tiebreaker countdown if active (e.g. page reload)
			if (data.tiebreakerActive) {
				setTiebreakerActive(true);
				setTiebreakerProposalIds(data.tiebreakerProposalIds || []);
				if (data.tiebreakerSecondsRemaining > 0 && tiebreakerCountdownRef.current === null) {
					startTiebreakerCountdownRef.current?.(data.tiebreakerSecondsRemaining);
				}
			}

			// Redirect to survey page if this is a survey session
			if (data.sessionType === "survey") {
				router.replace(`/session/survey/${sessionId}`);
				return;
			}

			// Session is not a survey, safe to render this page
			setSessionTypeVerified(true);

			if (data.phase) {
				if (data.phase === "closed" && !showSessionClosed) {
					await fetchWinningProposals();
					playEndSign();
					setShowSessionClosed(true);
				}

				setCurrentPhase(data.phase);

				if (isInitialLoad) {
					setIsInitialLoad(false);
				}
			}
		} catch (error) {
			console.error("Error fetching session info:", error);
			setLoading(false);
			setSessionTypeVerified(true);
		}
	}, [
		router,
		sessionId,
		showSessionClosed,
		isInitialLoad,
		fetchWinningProposals,
		playEndSign,
	]);

	const checkUserVote = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch(
				`/api/votes?checkSession=true&sessionId=${sessionId}`,
			);
			if (!res.ok) {
				console.error("Error checking user vote:", res.status);
				return;
			}
			const data = await res.json();
			setUserHasVotedInSession(data.hasVotedInSession);
			setVotedProposalId(data.votedProposalId);
		} catch (error) {
			console.error("Error checking user vote:", error);
		}
	}, [sessionId]);

	const checkPhaseTransition = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch(
				`/api/sessions/check-phase-transition?sessionId=${sessionId}`,
			);
			const data = await res.json();

			if (data.transitionScheduled) {
				setTransitionCountdown(data.secondsRemaining);
				if (transitionIntervalRef.current) {
					clearInterval(transitionIntervalRef.current);
					transitionIntervalRef.current = null;
				}

				transitionIntervalRef.current = setInterval(async () => {
					const execRes = await fetchWithCsrf(
						"/api/sessions/execute-scheduled-transition",
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ sessionId }),
						},
					);

					if (execRes.ok) {
						const execData = await execRes.json();

						if (execData.transitionExecuted) {
							if (transitionIntervalRef.current) {
								clearInterval(transitionIntervalRef.current);
								transitionIntervalRef.current = null;
							}
							setTransitionCountdown(null);
							setShowPhaseTransition(true);
							playEndSign();

							setTimeout(() => {
								fetchSessionInfo();
								fetchProposals();
								setShowPhaseTransition(false);
							}, 3000);
						} else if (execData.secondsRemaining !== undefined) {
							setTransitionCountdown(execData.secondsRemaining);
						}
					}
				}, 1000);

				setTimeout(() => {
					if (transitionIntervalRef.current) {
						clearInterval(transitionIntervalRef.current);
						transitionIntervalRef.current = null;
					}
				}, 110000);
			}
		} catch (error) {
			console.error("Error checking phase transition:", error);
		}
	}, [sessionId, fetchSessionInfo, fetchProposals, playEndSign]);

	const startTerminationCountdown = useCallback(
		(secondsRemaining) => {
			terminationCountdownRef.current = secondsRemaining;
			setTerminationCountdown(secondsRemaining);

			if (terminationIntervalRef.current) {
				clearInterval(terminationIntervalRef.current);
				terminationIntervalRef.current = null;
			}

			terminationIntervalRef.current = setInterval(async () => {
				terminationCountdownRef.current -= 1;
				const remaining = terminationCountdownRef.current;
				setTerminationCountdown(remaining);

				if (remaining <= 0) {
					clearInterval(terminationIntervalRef.current);
					terminationIntervalRef.current = null;

					// Execute termination
					let thisClientExecuted = false;
					try {
						const execRes = await fetchWithCsrf("/api/admin/execute-scheduled-termination", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ sessionId }),
						});
						const execData = await execRes.json();
						thisClientExecuted = execData.terminationExecuted;
						// Check if tiebreaker started instead of close
						if (execData.tiebreakerStarted) {
							setTerminationCountdown(null);
							setTiebreakerActive(true);
							setTiebreakerProposalIds(execData.tiedProposalIds);
							startTiebreakerCountdownRef.current?.(execData.secondsRemaining);
							return 0;
						}
					} catch (err) {
						console.error("Termination execute failed:", err);
					}
					setTerminationCountdown(null);
					if (thisClientExecuted) {
						// This client closed the session — results are ready
						setCurrentPhase("closed");
						await fetchWinningProposals();
						playEndSign();
						setShowSessionClosed(true);
					}
					// Other clients: Pusher tiebreaker-started or phase-change event handles display
				}
			}, 1000);

			// Safety: stop polling after 80 seconds
			setTimeout(() => {
				if (terminationIntervalRef.current) {
					clearInterval(terminationIntervalRef.current);
					terminationIntervalRef.current = null;
				}
			}, 80000);
		},
		[sessionId, fetchWinningProposals, playEndSign],
	);
	startTerminationCountdownRef.current = startTerminationCountdown;

	const startTiebreakerCountdown = useCallback(
		(secondsRemaining) => {
			tiebreakerCountdownRef.current = secondsRemaining;
			setTiebreakerCountdown(secondsRemaining);

			if (tiebreakerIntervalRef.current) {
				clearInterval(tiebreakerIntervalRef.current);
				tiebreakerIntervalRef.current = null;
			}

			tiebreakerIntervalRef.current = setInterval(async () => {
				tiebreakerCountdownRef.current -= 1;
				const remaining = tiebreakerCountdownRef.current;
				setTiebreakerCountdown(remaining);

				if (remaining <= 0) {
					clearInterval(tiebreakerIntervalRef.current);
					tiebreakerIntervalRef.current = null;

					let thisClientExecuted = false;
					try {
						const execRes = await fetchWithCsrf("/api/admin/execute-scheduled-termination", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ sessionId }),
						});
						const execData = await execRes.json();
						thisClientExecuted = execData.terminationExecuted;
					} catch (err) {
						console.error("Tiebreaker execute failed:", err);
					}
					setTiebreakerCountdown(null);
					setTiebreakerActive(false);
					setTiebreakerProposalIds([]);
					if (thisClientExecuted) {
						setCurrentPhase("closed");
						await fetchWinningProposals();
						playEndSign();
						setShowSessionClosed(true);
					}
				}
			}, 1000);

			setTimeout(() => {
				if (tiebreakerIntervalRef.current) {
					clearInterval(tiebreakerIntervalRef.current);
					tiebreakerIntervalRef.current = null;
				}
			}, 45000);
		},
		[sessionId, fetchWinningProposals, playEndSign],
	);
	startTiebreakerCountdownRef.current = startTiebreakerCountdown;

	// Setup SSE for real-time updates
	const { activeUserCount } = useSSE({
		onNewProposal: (proposal) => {
			if (proposal.sessionId === sessionId) {
				setProposals((prev) => [proposal, ...prev]);
				playNotification();
			}
		},
		onNewComment: () => {
			setCommentUpdateTrigger((prev) => prev + 1);
			playNotification();
		},
		onCommentRatingUpdate: () => {
			setCommentUpdateTrigger((prev) => prev + 1);
		},
		onVoteUpdate: (voteData) => {
			setProposals((prev) =>
				prev.map((p) =>
					p._id === voteData.proposalId
						? { ...p, yesVotes: voteData.yes, noVotes: voteData.no }
						: p,
				),
			);
		},
		onRatingUpdate: (ratingData) => {
			setProposals((prev) =>
				prev.map((p) =>
					p._id === ratingData.proposalId
						? {
								...p,
								thumbsUpCount: ratingData.thumbsUpCount,
								averageRating: ratingData.averageRating,
							}
						: p,
				),
			);
		},
		onPhaseChange: async (phaseData) => {
			if (phaseData.sessionId === sessionId) {
				setCurrentPhase(phaseData.phase);
				if (phaseData.phase === "phase2") {
					fetchProposals();
				}
				if (phaseData.phase === "closed" && !showSessionClosed) {
					setTerminationCountdown(null);
					setTiebreakerActive(false);
					setTiebreakerCountdown(null);
					setTiebreakerProposalIds([]);
					if (tiebreakerIntervalRef.current) {
						clearInterval(tiebreakerIntervalRef.current);
						tiebreakerIntervalRef.current = null;
					}
					await fetchWinningProposals();
					playEndSign();
					setShowSessionClosed(true);
				}
			}
		},
		onTransitionScheduled: (transitionData) => {
			if (transitionData.sessionId === sessionId) {
				playNotification();
				setTransitionCountdown(transitionData.secondsRemaining);
				checkPhaseTransition();
			}
		},
		onTerminationScheduled: (data) => {
			if (data.sessionId === sessionId) {
				playNotification();
				startTerminationCountdown(data.secondsRemaining);
			}
		},
		onTiebreakerStarted: (data) => {
			if (data.sessionId === sessionId) {
				playNotification();
				setTerminationCountdown(null);
				setTiebreakerActive(true);
				setTiebreakerProposalIds(data.tiedProposalIds);
				startTiebreakerCountdown(data.secondsRemaining);
			}
		},
		onNewSession: async () => {
			// Handled at home page level
		},
		onConnected: () => {},
		onError: (error) => {
			console.error("Connection error, will auto-reconnect:", error);
		},
	});

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	// Load data when sessionId is available
	useEffect(() => {
		if (session && sessionId) {
			fetchProposals();
			fetchSessionInfo();
			checkUserVote();
			checkPhaseTransition();
		}
	}, [
		session,
		sessionId,
		fetchProposals,
		fetchSessionInfo,
		checkUserVote,
		checkPhaseTransition,
	]);

	// Check if user has created a proposal
	// Note: authorId is only present on proposals the user owns (for anonymity)
	useEffect(() => {
		if (session && proposals.length > 0) {
			const hasCreated = proposals.some(
				(p) =>
					p.authorId !== undefined && p.authorId === session.user.id,
			);
			setUserHasCreatedProposal(hasCreated);
		}
	}, [proposals, session]);

	// Light polling as backup
	useEffect(() => {
		if (!session || !currentPhase || !sessionId) {
			return;
		}

		const pollInterval = setInterval(() => {
			fetchSessionInfo();
			if (currentPhase !== "closed") {
				fetchProposals();
			}
		}, 60000);

		return () => {
			clearInterval(pollInterval);
			if (transitionIntervalRef.current) {
				clearInterval(transitionIntervalRef.current);
				transitionIntervalRef.current = null;
			}
		};
	}, [session, currentPhase, sessionId, fetchSessionInfo, fetchProposals]);

	// Clean up termination and tiebreaker intervals only on unmount
	useEffect(() => {
		return () => {
			if (terminationIntervalRef.current) {
				clearInterval(terminationIntervalRef.current);
				terminationIntervalRef.current = null;
			}
			if (tiebreakerIntervalRef.current) {
				clearInterval(tiebreakerIntervalRef.current);
				tiebreakerIntervalRef.current = null;
			}
		};
	}, []);

	const handleCreateProposal = async (title, problem, solution) => {
		try {
			const res = await fetchWithCsrf("/api/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					problem,
					solution,
					sessionId,
				}),
			});

			if (res.ok) {
				setUserHasCreatedProposal(true);
				setView("home");
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error creating proposal:", error);
			alert("Ett fel uppstod vid skapande av förslag");
		}
	};

	const handleThumbsUp = async (proposalId, rating = 5) => {
		try {
			const res = await fetchWithCsrf("/api/thumbsup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, rating, sessionId }),
			});

			if (res.ok) {
				setExpandedRating(null);
				setUserHasRated(true);
				checkPhaseTransition();
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error voting:", error);
		}
	};

	const handleAddComment = async (proposalId, text, type = "neutral") => {
		try {
			const res = await fetchWithCsrf("/api/comments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, text, type, sessionId }),
			});

			if (!res.ok) {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error adding comment:", error);
		}
	};

	const handleFinalVote = async (proposalId, choice) => {
		try {
			const res = await fetchWithCsrf("/api/votes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, choice, sessionId }),
			});

			if (res.ok) {
				const data = await res.json();

				setUserHasVotedInSession(true);
				setVotedProposalId(proposalId);

				if (data.sessionClosed) {
					await fetchWinningProposals();
					await fetchSessionInfo();
					playEndSign();
					setShowSessionClosed(true);
				}
			} else {
				try {
					const data = await res.json();
					alert(data.message || "Ett fel uppstod vid röstning");
				} catch {
					alert("Ett fel uppstod vid röstning");
				}
			}
		} catch (error) {
			console.error("Error voting:", error);
			alert("Ett fel uppstod vid röstning");
		}
	};

	if (status === "loading" || loading || !sessionTypeVerified) {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center">
				<div className="text-xl text-gray-600">Laddar...</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	// Phase transition modal
	if (showPhaseTransition) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div className="bg-white rounded-3xl p-12 max-w-lg mx-4 text-center shadow-2xl animate-fade-in">
					<div className="text-6xl mb-6">🎉</div>
					<h2 className="text-3xl font-bold text-primary-800 mb-4">
						{t("phases.ideaPhaseComplete")}
					</h2>
					<p className="text-xl text-gray-700">
						{noMotivation ? t("phases.nowToVoting") : t("phases.nowToDebateAndVoting")}
					</p>
				</div>
			</div>
		);
	}

	// Session closed modal
	if (showSessionClosed) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
				<div className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
					<div className="text-center mb-6">
						<div className="text-6xl mb-4">✅</div>
						<h2 className="text-3xl font-bold text-primary-800 mb-4">
							{t("voting.votingClosed")}
						</h2>
						<p className="text-xl text-gray-700 mb-6">
							{t("voting.weHaveResult")}
						</p>
					</div>

					{winningProposals.length > 0 ? (
						<div className="space-y-4 mb-8">
							{winningProposals.map((proposal, index) => (
								<div
									key={proposal._id}
									className="bg-green-50 border-2 border-green-500 rounded-2xl p-6"
								>
									<div className="flex items-start gap-3">
										<div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
											<span className="text-white font-bold text-lg">
												{index + 1}
											</span>
										</div>
										<div className="flex-1">
											<h3 className="text-xl font-bold text-green-800 mb-2">
												{proposal.title}
											</h3>
											<div className="space-y-2 text-sm">
												{!noMotivation && (
													<>
														<div>
															<p className="font-semibold text-gray-700">
																{t(
																	"proposals.problemColon",
																)}
															</p>
															<p className="text-gray-600">
																{
																	proposal.problem
																}
															</p>
														</div>
														<div>
															<p className="font-semibold text-gray-700">
																{t(
																	"proposals.solutionColon",
																)}
															</p>
															<p className="text-gray-600">
																{
																	proposal.solution
																}
															</p>
														</div>
													</>
												)}
												<div className="flex gap-4 mt-3 text-sm">
													<span className="bg-green-200 text-green-800 px-3 py-1 rounded-full font-semibold">
														{t("voting.yes")}:{" "}
														{proposal.yesVotes}
													</span>
													<span className="bg-red-200 text-red-800 px-3 py-1 rounded-full font-semibold">
														{t("voting.no")}:{" "}
														{proposal.noVotes}
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="bg-gray-100 rounded-2xl p-8 text-center mb-8">
							<p className="text-gray-600">
								{t("voting.noMajority")}
							</p>
						</div>
					)}

					<div className="text-center">
						<p className="text-xl font-semibold text-primary-800 mb-4">
							{t("voting.thanksForParticipation")}
						</p>
						<button
							onClick={() => router.push("/")}
							className="bg-primary-800 hover:bg-primary-900 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-md"
						>
							{t("common.close")}
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Render different views
	if (view === "create") {
		return (
			<CreateProposalView
				onSubmit={handleCreateProposal}
				onBack={() => setView("home")}
				t={t}
				noMotivation={noMotivation}
			/>
		);
	}

	if (view === "vote") {
		let topProposals = proposals.filter((p) => p.status === "top3");
		if (tiebreakerActive && tiebreakerProposalIds.length > 0) {
			topProposals = topProposals.filter((p) => tiebreakerProposalIds.includes(p._id));
		}
		const initialIndex = selectedProposal
			? topProposals.findIndex((p) => p._id === selectedProposal)
			: 0;
		return (
			<VoteView
				proposals={topProposals}
				currentUser={session.user}
				onVote={handleFinalVote}
				onBack={() => {
					setView("home");
					setSelectedProposal(null);
				}}
				initialProposalIndex={initialIndex >= 0 ? initialIndex : 0}
				userHasVoted={userHasVotedInSession}
				t={t}
				noMotivation={noMotivation}
				onlyYesVotes={onlyYesVotes}
				tiebreakerActive={tiebreakerActive}
			/>
		);
	}

	// Home view - standard sessions only (surveys are handled by /session/survey/[id].js)
	const activeProposals = proposals
		.filter((p) => p.status === "active")
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	let topProposals = proposals
		.filter((p) => p.status === "top3")
		.sort((a, b) => {
			if (b.averageRating !== a.averageRating) {
				return (b.averageRating || 0) - (a.averageRating || 0);
			}
			return b.thumbsUpCount - a.thumbsUpCount;
		});
	if (tiebreakerActive && tiebreakerProposalIds.length > 0) {
		topProposals = topProposals.filter((p) => tiebreakerProposalIds.includes(p._id));
	}

	const displayProposals =
		currentPhase === "phase1" ? activeProposals : topProposals;

	const primaryColor = theme.colors.primary[600] || "#002d75";
	const accentColor = theme.colors.accent[400] || "#f8b60e";
	const primaryDark = theme.colors.primary[800] || "#001c55";

	return (
		<div className="min-h-screen bg-gray-50 overflow-x-hidden">
			<div
				className="text-white p-4 sm:p-6 shadow-lg overflow-x-hidden"
				style={{
					background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
				}}
			>
				<div className="max-w-4xl mx-auto">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
						<div className="flex items-center gap-3">
							<button
								onClick={() => router.push("/")}
								className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
								style={{ backgroundColor: accentColor }}
							>
								<ArrowLeft
									className="w-6 h-6"
									style={{ color: primaryDark }}
								/>
							</button>
							<div className="min-w-0">
								<h1 className="text-xl sm:text-2xl font-bold wrap-break-word">
									{t("appName")}
								</h1>
								<p className="text-primary-100 text-xs sm:text-sm wrap-break-word">
									{t("auth.hello")}, {session.user.name}!
								</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
							{session.user.isSuperAdmin && (
								<>
									<button
										onClick={() => router.push("/admin")}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.admin")}
									</button>
									<button
										onClick={() =>
											router.push("/manage-sessions")
										}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.manageSessions") ||
											"Manage Sessions"}
									</button>
								</>
							)}
							{session.user.isAdmin &&
								!session.user.isSuperAdmin && (
									<button
										onClick={() =>
											router.push("/manage-sessions")
										}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.manageSessions") ||
											"Manage Sessions"}
									</button>
								)}
							{showUserCount && (
								<div className="flex items-center gap-2 text-white font-medium whitespace-nowrap">
									<Users className="w-4 h-4" />
									<span>
										Antal inloggade: {activeUserCount}
									</span>
								</div>
							)}
							<button
								onClick={() => signOut()}
								className="text-white hover:text-accent-400 whitespace-nowrap"
							>
								{t("auth.logout")}
							</button>
						</div>
					</div>
					<h2 className="text-lg sm:text-xl font-medium wrap-break-word">
						{hasActiveSession && placeName
							? (() => {
									const words = placeName.split(/\s+/);
									return words.length > 8
										? words.slice(0, 8).join(" ") + "..."
										: placeName;
								})()
							: t("proposals.howToImproveYourSpace")}
					</h2>
				</div>
			</div>

			<div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
				{/* Show message when session not found */}
				{!hasActiveSession && (
					<div className="bg-white rounded-2xl p-8 text-center">
						<p className="text-gray-600 mb-4">
							Session not found or has been closed.
						</p>
						<button
							onClick={() => router.push("/")}
							className="bg-primary-800 hover:bg-primary-900 text-white font-bold py-3 px-8 rounded-xl transition-colors"
						>
							Back to Home
						</button>
					</div>
				)}

				{/* Only allow new proposals/responses in Phase 1 AND when countdown hasn't started AND session exists */}
				{hasActiveSession &&
					currentPhase === "phase1" &&
					transitionCountdown === null && (
						<button
							onClick={() => setView("create")}
							className="w-full font-bold py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105"
							style={{
								backgroundColor: accentColor,
								color: primaryDark,
							}}
						>
							<Plus className="w-6 h-6" />
							{t("proposals.proposeNewIdea")}
						</button>
					)}

				{/* Countdown banner for phase transition */}
				{transitionCountdown !== null && currentPhase === "phase1" && (
					<div className="bg-gradient-to-r from-accent-100 to-accent-50 border-2 border-accent-400 rounded-2xl p-4 sm:p-6 shadow-md">
						<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
							<Clock className="w-6 h-6 text-accent-600 animate-pulse shrink-0" />
							<p className="text-center text-base sm:text-lg font-semibold text-accent-800 wrap-break-word">
								{noMotivation ? t("phases.transitionToVoting") : t("phases.transitionToDebate")}{" "}
								<span className="text-xl sm:text-2xl font-bold text-accent-900">
									{transitionCountdown}
								</span>{" "}
								{t("common.seconds")}...
							</p>
						</div>
						<p className="text-center text-xs sm:text-sm text-accent-700 mt-2 wrap-break-word">
							{noMotivation ? t("phases.transitionMessageVotingOnly") : t("phases.transitionMessage")}
						</p>
					</div>
				)}

				{/* Countdown banner for Phase 2 termination */}
			{terminationCountdown !== null && currentPhase === "phase2" && (
				<div className="bg-gradient-to-r from-red-100 to-orange-50 border-2 border-red-400 rounded-2xl p-4 sm:p-6 shadow-md">
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<Clock className="w-6 h-6 text-red-600 animate-pulse shrink-0" />
						<p className="text-center text-base sm:text-lg font-semibold text-red-800 wrap-break-word">
							Röstningen avslutas om{" "}
							<span className="text-xl sm:text-2xl font-bold text-red-900">
								{terminationCountdown}
							</span>{" "}
							sekunder...
						</p>
					</div>
					<p className="text-center text-xs sm:text-sm text-red-700 mt-2 wrap-break-word">
						Resultaten visas när nedräkningen är klar.
					</p>
				</div>
			)}

			{/* Tiebreaker countdown banner */}
			{tiebreakerActive && tiebreakerCountdown !== null && currentPhase === "phase2" && (
				<div className="bg-gradient-to-r from-purple-100 to-indigo-50 border-2 border-purple-500 rounded-2xl p-4 sm:p-6 shadow-md">
					<div className="text-center mb-3">
						<p className="text-lg sm:text-xl font-bold text-purple-900">
							Resultatet är OAVGJORT
						</p>
					</div>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<Clock className="w-6 h-6 text-purple-600 animate-pulse shrink-0" />
						<p className="text-center text-base sm:text-lg font-semibold text-purple-800 wrap-break-word">
							Förlängd omröstning{" "}
							<span className="text-xl sm:text-2xl font-bold text-purple-900">
								{tiebreakerCountdown}
							</span>{" "}
							sekunder mellan förslagen.
						</p>
					</div>
					<p className="text-center text-xs sm:text-sm text-purple-700 mt-2 wrap-break-word">
						Du kan ändra din röst under denna tid.
					</p>
				</div>
			)}

			{/* Information about limited voting rights in Phase 2 */}
				{currentPhase === "phase2" && !userHasVotedInSession && (
					<div
						className={`bg-gradient-to-r ${
							config.theme === "red"
								? "from-blue-50 to-blue-100 border-2 border-blue-400"
								: "from-primary-50 to-primary-100 border-2 border-primary-400"
						} rounded-2xl p-4 sm:p-6 shadow-md`}
					>
						<div className="flex flex-col sm:flex-row items-start gap-4">
							<div
								className={`w-12 h-12 ${
									config.theme === "red"
										? "bg-blue-500"
										: "bg-primary-500"
								} rounded-full flex items-center justify-center shrink-0`}
							>
								<Info className="w-6 h-6 text-white" />
							</div>
							<div className="flex-1 min-w-0">
								<h3
									className={`text-base sm:text-lg font-bold ${
										config.theme === "red"
											? "text-blue-900"
											: "text-primary-900"
									} mb-2 wrap-break-word`}
								>
									{t("voting.limitedVotingRights")}
								</h3>
								<p className="text-gray-700 text-sm leading-relaxed mb-2 wrap-break-word">
									{t("voting.oneVotePerSession")}
								</p>
								<p className="text-gray-700 text-sm leading-relaxed wrap-break-word">
									{t("voting.votingAdvantages")}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* User has voted - show confirmation (hidden during tiebreaker to allow re-voting) */}
				{currentPhase === "phase2" && userHasVotedInSession && !tiebreakerActive && (
					<div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-4 sm:p-6 shadow-md">
						<div className="flex flex-col items-center gap-4">
							<div className="flex flex-col sm:flex-row items-center gap-3">
								<div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shrink-0">
									<span className="text-2xl text-white">
										✓
									</span>
								</div>
								<div className="text-center min-w-0">
									<h3 className="text-base sm:text-lg font-bold text-green-900 wrap-break-word">
										{t("voting.thanksForVote")}
									</h3>
									<p className="text-gray-700 text-xs sm:text-sm wrap-break-word">
										{t("voting.sessionClosesWhen")}
									</p>
								</div>
							</div>
							{votedProposalId && (
								<button
									onClick={() => {
										setSelectedProposal(votedProposalId);
										setView("vote");
									}}
									className="bg-primary-700 hover:bg-primary-800 text-white px-4 sm:px-6 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
								>
									{t("voting.viewYourVote")}
								</button>
							)}
						</div>
					</div>
				)}

				{/* Vote section - show if user hasn't voted yet, or during tiebreaker */}
				{currentPhase === "phase2" &&
					(!userHasVotedInSession || tiebreakerActive) &&
					topProposals.length > 0 && (
						<div className="bg-accent-50 border-2 border-accent-400 rounded-2xl p-4 sm:p-6 space-y-4">
							<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
								<div className="flex items-center gap-2 min-w-0">
									<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-accent-600 shrink-0" />
									<h3 className="text-lg sm:text-xl font-bold text-primary-800 wrap-break-word">
										{t("proposals.topProposals")}
									</h3>
								</div>
								<button
									onClick={() => {
										setSelectedProposal(null);
										setView("vote");
									}}
									className="w-full sm:w-auto bg-primary-800 hover:bg-primary-900 text-white px-4 py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap"
								>
									{t("proposals.vote")}
								</button>
							</div>
							<p className="text-gray-700 text-sm sm:text-base wrap-break-word">
								{t("proposals.clickToDebateAndVote")}
							</p>
						</div>
					)}

				{hasActiveSession && (
					<div className="space-y-4">
						<h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
							<MessageCircle className="w-5 h-5" />
							{currentPhase === "phase1"
								? t("proposals.allProposalsCount", {
										count: displayProposals.length,
									})
								: t("proposals.topProposalsCount", {
										count: displayProposals.length,
									})}
						</h3>

						{displayProposals.length === 0 ? (
							<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
								<p>
									{currentPhase === "phase1"
										? t("proposals.noProposals")
										: t("proposals.noTopProposals")}
								</p>
							</div>
						) : (
							displayProposals.map((proposal) => (
								<ProposalCard
									key={proposal._id}
									proposal={proposal}
									currentPhase={currentPhase}
									expandedRating={expandedRating}
									setExpandedRating={setExpandedRating}
									expandedProposal={expandedProposal}
									setExpandedProposal={setExpandedProposal}
									onThumbsUp={handleThumbsUp}
									onAddComment={handleAddComment}
									onVote={() => {
										setSelectedProposal(proposal._id);
										setView("vote");
									}}
									userHasVotedInSession={
										userHasVotedInSession
									}
									votedProposalId={votedProposalId}
									commentUpdateTrigger={commentUpdateTrigger}
									t={t}
									noMotivation={noMotivation}
									sessionId={sessionId}
									tiebreakerActive={tiebreakerActive}
								/>
							))
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// PROPOSAL CARD COMPONENT
// ============================================================================

function ProposalCard({
	proposal,
	currentPhase,
	expandedRating,
	setExpandedRating,
	expandedProposal,
	setExpandedProposal,
	onThumbsUp,
	onAddComment,
	onVote,
	userHasVotedInSession,
	votedProposalId,
	commentUpdateTrigger,
	t,
	noMotivation,
	sessionId,
	tiebreakerActive = false,
}) {
	const [hasVoted, setHasVoted] = useState(false);
	const [checking, setChecking] = useState(true);
	const [userRating, setUserRating] = useState(0);
	const [confirmedRating, setConfirmedRating] = useState(0);
	const [showConfirmation, setShowConfirmation] = useState(false);
	const [comments, setComments] = useState([]);
	const [loadingComments, setLoadingComments] = useState(false);
	const [commentText, setCommentText] = useState("");
	const [commentType, setCommentType] = useState("neutral");
	const [submitting, setSubmitting] = useState(false);
	const [expandedCommentRating, setExpandedCommentRating] = useState(null);
	const [commentRatings, setCommentRatings] = useState({});

	const isExpanded = expandedRating === proposal._id;
	const isExpandedForDiscuss = expandedProposal === proposal._id;
	const isPhase1 = currentPhase === "phase1";

	const checkIfVoted = useCallback(async () => {
		try {
			const res = await fetch(`/api/thumbsup?proposalId=${proposal._id}`);
			const data = await res.json();
			setHasVoted(data.voted);
			setUserRating(data.rating || 0);
		} catch (error) {
			console.error("Error checking vote status:", error);
		} finally {
			setChecking(false);
		}
	}, [proposal._id]);

	const fetchComments = useCallback(async () => {
		setLoadingComments(true);
		try {
			const res = await fetch(`/api/comments?proposalId=${proposal._id}`);
			const data = await res.json();
			setComments(data);
		} catch (error) {
			console.error("Error fetching comments:", error);
		} finally {
			setLoadingComments(false);
		}
	}, [proposal._id]);

	useEffect(() => {
		checkIfVoted();
	}, [proposal._id, checkIfVoted]);

	useEffect(() => {
		if (isExpandedForDiscuss) {
			fetchComments();
		}
	}, [isExpandedForDiscuss, fetchComments]);

	useEffect(() => {
		if (isExpandedForDiscuss && commentUpdateTrigger > 0) {
			fetchComments();
		}
	}, [commentUpdateTrigger, isExpandedForDiscuss, fetchComments]);

	const handleStarClick = async (rating) => {
		setConfirmedRating(rating);
		setShowConfirmation(true);
		await onThumbsUp(proposal._id, rating);
		setHasVoted(true);
		setUserRating(rating);
		setTimeout(() => {
			setShowConfirmation(false);
			setConfirmedRating(0);
		}, 1500);
	};

	const handleToggleDiscuss = () => {
		setExpandedProposal(isExpandedForDiscuss ? null : proposal._id);
	};

	const handleSubmitComment = async (e) => {
		e.preventDefault();
		if (commentText.trim()) {
			setSubmitting(true);
			await onAddComment(proposal._id, commentText.trim(), commentType);
			setCommentText("");
			setCommentType("neutral");
			await fetchComments();
			setSubmitting(false);
		}
	};

	const handleRateComment = async (commentId, rating) => {
		try {
			const res = await fetchWithCsrf("/api/comments/rate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ commentId, rating, sessionId }),
			});

			if (res.ok) {
				setCommentRatings({ ...commentRatings, [commentId]: rating });
				await fetchComments();
				setExpandedCommentRating(null);
			}
		} catch (error) {
			console.error("Error rating comment:", error);
		}
	};

	const fetchCommentRating = async (commentId) => {
		try {
			const res = await fetch(
				`/api/comments/rate?commentId=${commentId}`,
			);
			if (res.ok) {
				const data = await res.json();
				return data.userRating;
			}
		} catch (error) {
			console.error("Error fetching comment rating:", error);
		}
		return 0;
	};

	useEffect(() => {
		const fetchAllRatings = async () => {
			const ratings = {};
			for (const comment of comments) {
				const rating = await fetchCommentRating(comment._id);
				ratings[comment._id] = rating;
			}
			setCommentRatings(ratings);
		};
		if (comments.length > 0) {
			fetchAllRatings();
		}
	}, [comments.length, comments]);

	return (
		<div className="bg-white rounded-2xl shadow-md p-4 sm:p-6 space-y-4">
			{/* Proposal header - clickable in Phase 2 */}
			<div
				className={
					!isPhase1 && !noMotivation
						? "cursor-pointer hover:bg-primary-50 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 rounded-t-2xl transition-all duration-200 hover:shadow-sm relative"
						: ""
				}
				onClick={!isPhase1 && !noMotivation ? handleToggleDiscuss : undefined}
			>
				<div className="flex items-start gap-2 mb-2">
					<h4
						className={`text-lg font-bold text-primary-800 wrap-break-word flex-1 ${
							!isPhase1 ? "group-hover:text-primary-900" : ""
						}`}
					>
						{proposal.title}
					</h4>
					{proposal.authorId && (
						<span className="inline-block px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded whitespace-nowrap">
							{t("proposal.yourProposal") || "Ditt förslag"}
						</span>
					)}
				</div>

				{!noMotivation && (
					<div className="space-y-3 text-sm">
						<div>
							<p className="font-semibold text-gray-700">
								{t("proposals.problemColon")}
							</p>
							<p className="text-gray-600 wrap-break-word">
								{proposal.problem}
							</p>
						</div>

						<div>
							<p className="font-semibold text-gray-700">
								{t("proposals.solutionColon")}
							</p>
							<p className="text-gray-600 wrap-break-word">
								{proposal.solution}
							</p>
						</div>
					</div>
				)}

				{!isPhase1 && !noMotivation && !isExpandedForDiscuss && (
					<div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded-lg shadow-sm border border-gray-200 pointer-events-none">
						▼ {t("comments.showArguments")}
					</div>
				)}
			</div>

			{/* Phase 1: Expandable star rating */}
			{isPhase1 && (
				<div>
					<button
						onClick={() =>
							setExpandedRating(isExpanded ? null : proposal._id)
						}
						disabled={checking}
						className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
							hasVoted
								? "bg-primary-100 text-primary-600"
								: "bg-gray-100 hover:bg-primary-100 text-gray-700 hover:text-primary-600"
						}`}
					>
						<ThumbsUp className="w-5 h-5" />
						<span>
							{hasVoted
								? t("rating.changeRating")
								: t("rating.giveRating")}
						</span>
					</button>

					{hasVoted && userRating > 0 && !isExpanded && (
						<div className="mt-2 flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-lg">
							<span className="text-sm text-primary-800 font-medium">
								{t("rating.yourRating")}:
							</span>
							<div className="flex gap-0.5">
								{[1, 2, 3, 4, 5].map((star) => (
									<Star
										key={star}
										className={`w-5 h-5 ${
											star <= userRating
												? "fill-yellow-400 text-accent-400"
												: "text-gray-300"
										}`}
									/>
								))}
							</div>
						</div>
					)}

					{isExpanded && (
						<div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
							{[1, 2, 3, 4, 5].map((star) => {
								const isConfirmed =
									showConfirmation && star <= confirmedRating;
								return (
									<button
										key={star}
										onClick={() => handleStarClick(star)}
										className="transition-transform hover:scale-125"
									>
										<Star
											className={`w-8 h-8 ${
												isConfirmed
													? "fill-red-600 text-red-600 animate-pulse"
													: star <= userRating
														? "fill-yellow-400 text-accent-400"
														: "text-gray-300 hover:text-accent-400"
											}`}
										/>
									</button>
								);
							})}
							<span className="ml-2 text-sm text-gray-600">
								{showConfirmation
									? t("rating.ratingRegistered", {
											rating: confirmedRating,
										})
									: t("rating.clickStar")}
							</span>
						</div>
					)}
				</div>
			)}

			{/* Phase 2: Show rating */}
			{!isPhase1 && (
				<div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-100 text-primary-600 font-medium">
					<ThumbsUp className="w-5 h-5" />
					<span className="font-bold">{proposal.thumbsUpCount}</span>
					{proposal.averageRating > 0 && (
						<span className="ml-2">
							⭐ {proposal.averageRating.toFixed(1)}
						</span>
					)}
				</div>
			)}

			{/* Expanded discussion area for Phase 2 */}
			{!isPhase1 && !noMotivation && isExpandedForDiscuss && (
				<div className="space-y-4 border-t pt-4">
					{/* Comment type selector */}
					<div className="flex flex-col sm:flex-row gap-2">
						<button
							type="button"
							onClick={() => setCommentType("neutral")}
							className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
								commentType === "neutral"
									? "bg-gray-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							{t("comments.neutral")}
						</button>
						<button
							type="button"
							onClick={() => setCommentType("for")}
							className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
								commentType === "for"
									? "bg-green-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							👍 {t("comments.for")}
						</button>
						<button
							type="button"
							onClick={() => setCommentType("against")}
							className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
								commentType === "against"
									? "bg-red-600 text-white"
									: "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							👎 {t("comments.against")}
						</button>
					</div>

					{/* Comment input */}
					<form
						onSubmit={handleSubmitComment}
						className="flex flex-col sm:flex-row gap-2"
					>
						<input
							type="text"
							value={commentText}
							onChange={(e) => setCommentText(e.target.value)}
							className="flex-1 px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none text-xs sm:text-sm"
							placeholder={t("comments.writeArgument")}
							maxLength={1000}
						/>
						<button
							type="submit"
							disabled={!commentText.trim() || submitting}
							className="bg-primary-800 hover:bg-primary-900 disabled:bg-gray-300 disabled:text-gray-500 text-white px-4 py-2 rounded-xl font-medium transition-colors text-xs sm:text-sm whitespace-nowrap"
						>
							{submitting
								? t("comments.sending")
								: t("comments.send")}
						</button>
					</form>

					{/* Comments list */}
					{loadingComments ? (
						<div className="text-center text-gray-500 py-4">
							Laddar...
						</div>
					) : comments.length === 0 ? (
						<div className="text-center text-gray-500 py-4">
							{t("comments.noArgumentsYet")}
						</div>
					) : (
						<div className="space-y-3">
							{comments.map((comment) => {
								const bgColor =
									comment.type === "for"
										? "bg-green-50"
										: comment.type === "against"
											? "bg-red-50"
											: "bg-white";

								const isCommentRatingExpanded =
									expandedCommentRating === comment._id;
								const userCommentRating =
									commentRatings[comment._id] || 0;
								const avgRating = comment.averageRating || 0;

								return (
									<div
										key={comment._id}
										className={`rounded-xl shadow-sm p-4 ${bgColor}`}
									>
										<div className="flex items-start gap-3">
											{/* Left side: Rating display and button */}
											<div className="flex flex-col items-center gap-2 shrink-0">
												<button
													onClick={() =>
														setExpandedCommentRating(
															isCommentRatingExpanded
																? null
																: comment._id,
														)
													}
													className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
														userCommentRating > 0
															? comment.type ===
																"for"
																? "bg-green-500 hover:bg-green-600"
																: comment.type ===
																	  "against"
																	? "bg-red-500 hover:bg-red-600"
																	: "bg-primary-500 hover:bg-primary-600"
															: "bg-gray-300 hover:bg-gray-400"
													}`}
													title={
														userCommentRating > 0
															? `${t("rating.yourRating")}: ${userCommentRating}/5`
															: t(
																	"rating.giveRating",
																)
													}
												>
													<ThumbsUp className="w-5 h-5 text-white" />
												</button>

												{userCommentRating > 0 && (
													<div className="flex flex-col items-center gap-0.5 bg-white px-2 py-1 rounded-md border border-gray-200">
														<span className="text-xs text-gray-500 font-medium">
															{t(
																"rating.yourRating",
															)}
														</span>
														<div className="flex gap-0.5">
															{[
																1, 2, 3, 4, 5,
															].map((star) => (
																<Star
																	key={star}
																	className={`w-3 h-3 ${
																		star <=
																		userCommentRating
																			? "fill-blue-500 text-primary-500"
																			: "text-gray-300"
																	}`}
																/>
															))}
														</div>
													</div>
												)}

												{avgRating > 0 && (
													<div className="flex flex-col items-center gap-0.5">
														<span className="text-xs text-gray-400">
															Ø{" "}
															{avgRating.toFixed(
																1,
															)}
														</span>
														<div className="flex gap-0.5">
															{[
																1, 2, 3, 4, 5,
															].map((star) => (
																<Star
																	key={star}
																	className={`w-2.5 h-2.5 ${
																		star <=
																		Math.round(
																			avgRating,
																		)
																			? "fill-yellow-400 text-accent-400"
																			: "text-gray-300"
																	}`}
																/>
															))}
														</div>
													</div>
												)}
											</div>

											{/* Right side: Comment content */}
											<div className="flex-1 min-w-0">
												{comment.isOwn && (
													<span className="inline-block px-2 py-0.5 mb-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
														{t(
															"comment.yourComment",
														) || "Ditt argument"}
													</span>
												)}
												<p className="text-gray-700 text-sm leading-relaxed wrap-break-word">
													{comment.text}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{formatDateTime(
														comment.createdAt,
													)}
												</p>

												{isCommentRatingExpanded && (
													<div className="mt-3 flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
														<span className="text-sm text-gray-600">
															{userCommentRating >
															0
																? t(
																		"rating.changeRating",
																	)
																: t(
																		"rating.giveRating",
																	)}
															:
														</span>
														{[1, 2, 3, 4, 5].map(
															(star) => (
																<button
																	key={star}
																	onClick={() =>
																		handleRateComment(
																			comment._id,
																			star,
																		)
																	}
																	className="transition-transform hover:scale-125"
																>
																	<Star
																		className={`w-6 h-6 ${
																			star <=
																			userCommentRating
																				? "fill-yellow-400 text-accent-400"
																				: "text-gray-300 hover:text-accent-400"
																		}`}
																	/>
																</button>
															),
														)}
													</div>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}

					{/* Vote button and collapse indicator */}
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
						{tiebreakerActive ? (
							<button
								onClick={onVote}
								className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 rounded-xl transition-colors text-sm sm:text-base"
							>
								{userHasVotedInSession && votedProposalId === proposal._id
									? "Ändra röst"
									: "Rösta"}
							</button>
						) : userHasVotedInSession &&
						votedProposalId === proposal._id ? (
							<div className="flex-1 bg-green-100 border-2 border-green-500 text-green-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base">
								<span className="text-xl">✓</span>
								<span>{t("voting.youHaveVoted")}</span>
							</div>
						) : userHasVotedInSession ? (
							<div className="flex-1 bg-gray-100 text-gray-500 font-bold py-3 px-4 rounded-xl text-center cursor-not-allowed text-sm sm:text-base wrap-break-word">
								{t("voting.alreadyUsedVote")}
							</div>
						) : (
							<button
								onClick={onVote}
								className="flex-1 bg-primary-800 hover:bg-primary-900 text-white font-bold py-3 rounded-xl transition-colors text-sm sm:text-base"
							>
								{t("voting.vote")}
							</button>
						)}
						<button
							onClick={handleToggleDiscuss}
							className="text-xs text-gray-500 hover:text-gray-700 bg-white px-3 py-3 rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-colors whitespace-nowrap"
						>
							▲ {t("comments.hide")}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// CREATE PROPOSAL VIEW
// ============================================================================

function CreateProposalView({ onSubmit, onBack, t, noMotivation }) {
	const [title, setTitle] = useState("");
	const [problem, setProblem] = useState("");
	const [solution, setSolution] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (noMotivation) {
			if (title.trim()) {
				setSubmitting(true);
				await onSubmit(title.trim(), "", "");
				setSubmitting(false);
			}
		} else {
			if (title.trim() && problem.trim() && solution.trim()) {
				setSubmitting(true);
				await onSubmit(title.trim(), problem.trim(), solution.trim());
				setSubmitting(false);
			}
		}
	};

	return (
		<div className="min-h-screen bg-accent-50 p-4 sm:p-6 overflow-x-hidden">
			<div className="max-w-2xl mx-auto">
				<button
					onClick={onBack}
					className="mb-4 sm:mb-6 text-primary-600 hover:text-primary-700 font-medium text-sm sm:text-base"
				>
					← {t("common.back")}
				</button>

				<div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
					<h2 className="text-xl sm:text-2xl font-bold text-primary-800 mb-4 sm:mb-6 wrap-break-word">
						{t("createProposal.title")}
					</h2>

					<form
						onSubmit={handleSubmit}
						className="space-y-4 sm:space-y-6"
					>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("createProposal.nameOfProposal")}
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none"
								placeholder={t("createProposal.nameExample")}
								autoFocus
								maxLength={200}
								required
							/>
						</div>

						{!noMotivation && (
							<>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										{t("createProposal.problemLabel")}
									</label>
									<textarea
										value={problem}
										onChange={(e) =>
											setProblem(e.target.value)
										}
										rows={4}
										className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none resize-none"
										placeholder={t(
											"createProposal.problemPlaceholder",
										)}
										maxLength={1000}
										required
									/>
									<p className="text-xs text-gray-500 mt-1">
										{problem.length}/1000
									</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										{t("createProposal.solutionLabel")}
									</label>
									<textarea
										value={solution}
										onChange={(e) =>
											setSolution(e.target.value)
										}
										rows={4}
										className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none resize-none"
										placeholder={t(
											"createProposal.solutionPlaceholder",
										)}
										maxLength={1000}
										required
									/>
									<p className="text-xs text-gray-500 mt-1">
										{solution.length}/1000
									</p>
								</div>
							</>
						)}

						<button
							type="submit"
							disabled={
								!title.trim() ||
								(!noMotivation &&
									(!problem.trim() || !solution.trim())) ||
								submitting
							}
							className="w-full bg-primary-800 hover:bg-primary-900 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors shadow-lg"
						>
							{submitting
								? t("createProposal.submitting")
								: t("createProposal.submit")}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// VOTE VIEW
// ============================================================================

function VoteView({
	proposals,
	currentUser,
	onVote,
	onBack,
	initialProposalIndex = 0,
	userHasVoted = false,
	t,
	noMotivation,
	onlyYesVotes,
	tiebreakerActive = false,
}) {
	const [currentProposalIndex, setCurrentProposalIndex] =
		useState(initialProposalIndex);
	const [votedProposals, setVotedProposals] = useState(new Set());
	const [voteResults, setVoteResults] = useState({});
	const [loading, setLoading] = useState(true);
	const [isVoting, setIsVoting] = useState(false);
	const [hasVotedInThisSession, setHasVotedInThisSession] =
		useState(userHasVoted);
	const [confirmVote, setConfirmVote] = useState(null);

	const fetchVoteData = useCallback(async () => {
		try {
			const resultsPromises = proposals.map(async (p) => {
				const res = await fetch(
					`/api/votes?proposalId=${p._id}&userId=${currentUser.id}`,
				);
				const data = await res.json();
				return { id: p._id, data };
			});

			const results = await Promise.all(resultsPromises);

			const newVotedProposals = new Set();
			const newVoteResults = {};

			results.forEach(({ id, data }) => {
				if (data.hasVoted) {
					newVotedProposals.add(id);
				}
				newVoteResults[id] = data;
			});

			setVotedProposals(newVotedProposals);
			setVoteResults(newVoteResults);
		} catch (error) {
			console.error("Error fetching vote data:", error);
		} finally {
			setLoading(false);
		}
	}, [proposals, currentUser.id]);

	useEffect(() => {
		fetchVoteData();
	}, [fetchVoteData]);

	const handleVote = async (proposalId, choice) => {
		setIsVoting(true);
		await onVote(proposalId, choice);
		await fetchVoteData();
		setHasVotedInThisSession(true);
		setIsVoting(false);
	};

	const currentProposal = proposals[currentProposalIndex];
	const voted = currentProposal
		? votedProposals.has(currentProposal._id)
		: false;
	const results = currentProposal
		? voteResults[currentProposal._id] || { yes: 0, no: 0, total: 0 }
		: { yes: 0, no: 0, total: 0 };

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary-800 flex items-center justify-center">
				<div className="text-white text-xl">{t("common.loading")}</div>
			</div>
		);
	}

	if (!currentProposal) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary-800 flex items-center justify-center">
				<div className="text-center text-white">
					<p className="text-xl">{t("voting.noProposals")}</p>
					<button
						onClick={onBack}
						className="mt-4 px-6 py-3 bg-white text-primary-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
					>
						{t("common.back")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 text-white overflow-x-hidden">
			{/* Header */}
			<div className="border-b border-primary-700 bg-primary-900/50 backdrop-blur">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
					<button
						onClick={onBack}
						className="mb-3 sm:mb-4 text-primary-200 hover:text-white font-medium transition-colors text-sm sm:text-base"
					>
						← {t("common.back")}
					</button>
					<div className="text-center">
						<h1 className="text-2xl sm:text-3xl font-bold mb-2 wrap-break-word">
							{t("voting.officialVoting")}
						</h1>
						<p className="text-primary-200 text-base sm:text-lg wrap-break-word">
							{t("voting.yourVoteMatters")}
						</p>
					</div>
				</div>
			</div>

			{/* Progress indicator */}
			<div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
				<div className="flex items-center justify-center gap-2">
					{proposals.map((_, index) => (
						<div
							key={index}
							className={`h-2 rounded-full transition-all ${
								index === currentProposalIndex
									? "w-12 bg-accent-400"
									: index < currentProposalIndex
										? "w-8 bg-green-400"
										: "w-8 bg-primary-700"
							}`}
						/>
					))}
				</div>
				<p className="text-center text-primary-200 mt-3 text-sm">
					{t("voting.proposalXOfY", {
						current: currentProposalIndex + 1,
						total: proposals.length,
					})}
				</p>
			</div>

			{/* Main voting card */}
			<div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
				<div className="bg-white text-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border-2 sm:border-4 border-accent-400">
					{/* Proposal header */}
					<div className="bg-gradient-to-r from-accent-400 to-accent-500 px-4 sm:px-8 py-4 sm:py-6 text-center">
						<h2 className="text-xl sm:text-2xl font-bold text-primary-900 wrap-break-word">
							{currentProposal.title}
						</h2>
					</div>

					{/* Proposal content */}
					<div className="px-4 sm:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
						{!noMotivation && (
							<>
								<div>
									<h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
										{t("proposals.problemColon")}
									</h3>
									<p className="text-base sm:text-lg leading-relaxed text-gray-800 wrap-break-word">
										{currentProposal.problem}
									</p>
								</div>

								<div className="border-t border-gray-200 pt-4 sm:pt-6">
									<h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
										{t("proposals.solutionColon")}
									</h3>
									<p className="text-base sm:text-lg leading-relaxed text-gray-800 wrap-break-word">
										{currentProposal.solution}
									</p>
								</div>
							</>
						)}
					</div>

					{/* Voting section */}
					{!voted || tiebreakerActive ? (
						<div className="px-4 sm:px-8 pb-6 sm:pb-8">
							<div className={`border-t-4 ${tiebreakerActive ? "border-purple-400" : "border-accent-400"} pt-6 sm:pt-8`}>
								{tiebreakerActive && voted && (
									<div className="text-center mb-3">
										<span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
											✓ Din nuvarande röst
										</span>
									</div>
								)}
								{onlyYesVotes && proposals.length > 1 && (
									<p className="text-center text-sm text-gray-500 mb-2">
										Förslag {currentProposalIndex + 1} av {proposals.length}
									</p>
								)}
								<p className="text-center text-base sm:text-lg font-semibold text-gray-700 mb-4 sm:mb-6 wrap-break-word">
									{tiebreakerActive ? "Rösta eller ändra din röst" : t("voting.castYourVote")}
								</p>
								{onlyYesVotes ? (
									<div className="grid grid-cols-2 gap-3 sm:gap-6">
										<button
											onClick={() => setConfirmVote(currentProposal)}
											disabled={isVoting}
											className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 sm:py-6 px-4 sm:px-8 rounded-xl sm:rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-lg flex flex-col items-center justify-center gap-2 sm:gap-3"
										>
											<ThumbsUp className="w-8 h-8 sm:w-12 sm:h-12" />
											<span className="text-lg sm:text-2xl">
												{t("voting.yes")}
											</span>
										</button>
										<button
											onClick={() =>
												setCurrentProposalIndex(
													(currentProposalIndex + 1) % proposals.length,
												)
											}
											className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 sm:py-6 px-4 sm:px-8 rounded-xl sm:rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-lg flex flex-col items-center justify-center gap-2 sm:gap-3"
										>
											<ChevronRight className="w-8 h-8 sm:w-12 sm:h-12" />
											<span className="text-lg sm:text-2xl">
												Nästa förslag
											</span>
										</button>
									</div>
								) : (
									<div className="grid grid-cols-2 gap-3 sm:gap-6">
										<button
											onClick={() =>
												handleVote(
													currentProposal._id,
													"yes",
												)
											}
											disabled={isVoting}
											className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 sm:py-6 px-4 sm:px-8 rounded-xl sm:rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-lg flex flex-col items-center justify-center gap-2 sm:gap-3"
										>
											<ThumbsUp className="w-8 h-8 sm:w-12 sm:h-12" />
											<span className="text-lg sm:text-2xl">
												{t("voting.yes")}
											</span>
										</button>
										<button
											onClick={() =>
												handleVote(
													currentProposal._id,
													"no",
												)
											}
											disabled={isVoting}
											className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 sm:py-6 px-4 sm:px-8 rounded-xl sm:rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-lg flex flex-col items-center justify-center gap-2 sm:gap-3"
										>
											<ThumbsDown className="w-8 h-8 sm:w-12 sm:h-12" />
											<span className="text-lg sm:text-2xl">
												{t("voting.no")}
											</span>
										</button>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="px-4 sm:px-8 pb-6 sm:pb-8">
							<div className="border-t-4 border-green-400 pt-6 sm:pt-8 space-y-4">
								<div className="text-center">
									<div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 sm:px-6 py-2 sm:py-3 rounded-full font-semibold text-sm sm:text-base">
										<span className="text-xl sm:text-2xl">
											✓
										</span>
										<span>{t("voting.youHaveVoted")}</span>
									</div>
								</div>
								{onlyYesVotes ? (
									<div className="pt-4">
										<div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 sm:p-4 text-center">
											<p className="text-3xl sm:text-4xl font-bold text-green-700">
												{results.yes}
											</p>
											<p className="text-xs sm:text-sm text-green-600 font-medium mt-1">
												{t("voting.yesVotes")}
											</p>
										</div>
									</div>
								) : (
									<div className="grid grid-cols-2 gap-3 sm:gap-4 pt-4">
										<div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 sm:p-4 text-center">
											<p className="text-3xl sm:text-4xl font-bold text-green-700">
												{results.yes}
											</p>
											<p className="text-xs sm:text-sm text-green-600 font-medium mt-1">
												{t("voting.yesVotes")}
											</p>
										</div>
										<div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 sm:p-4 text-center">
											<p className="text-3xl sm:text-4xl font-bold text-red-700">
												{results.no}
											</p>
											<p className="text-xs sm:text-sm text-red-600 font-medium mt-1">
												{t("voting.noVotes")}
											</p>
										</div>
									</div>
								)}
								<p className="text-center text-xs sm:text-sm text-gray-500 pt-2">
									{t("voting.totalVotes", {
										count: results.total,
									})}
								</p>
								{!hasVotedInThisSession &&
									currentProposalIndex <
										proposals.length - 1 && (
										<button
											onClick={() =>
												setCurrentProposalIndex(
													currentProposalIndex + 1,
												)
											}
											className="w-full mt-4 bg-primary-800 hover:bg-primary-900 text-white font-semibold py-3 rounded-xl transition-colors text-sm sm:text-base"
										>
											{t("voting.nextProposal")} →
										</button>
									)}
							</div>
						</div>
					)}
				</div>

				{/* Confirmation popup for onlyYesVotes */}
				{confirmVote && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
						<div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
							<p className="text-lg sm:text-xl font-semibold text-gray-800 text-center mb-6">
								Är du säker på att du vill rösta på{" "}
								<span className="text-primary-700">&quot;{confirmVote.title}&quot;</span>?
							</p>
							<div className="grid grid-cols-2 gap-3">
								<button
									onClick={async () => {
										const proposal = confirmVote;
										setConfirmVote(null);
										await handleVote(proposal._id, "yes");
									}}
									disabled={isVoting}
									className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 sm:py-4 rounded-xl transition-colors text-lg"
								>
									Ja
								</button>
								<button
									onClick={() => setConfirmVote(null)}
									className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 sm:py-4 rounded-xl transition-colors text-lg"
								>
									Avbryt
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Navigation buttons - show if user hasn't voted yet (or during tiebreaker) and not onlyYesVotes */}
				{!onlyYesVotes && (!hasVotedInThisSession || tiebreakerActive) && proposals.length > 1 && (
					<div className="flex justify-between gap-3 mt-6">
						<button
							onClick={() =>
								setCurrentProposalIndex(
									Math.max(0, currentProposalIndex - 1),
								)
							}
							disabled={currentProposalIndex === 0}
							className="px-4 sm:px-6 py-2 sm:py-3 bg-primary-700 hover:bg-primary-600 disabled:bg-primary-900 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors text-sm sm:text-base"
						>
							← {t("voting.previous")}
						</button>
						<button
							onClick={() =>
								setCurrentProposalIndex(
									Math.min(
										proposals.length - 1,
										currentProposalIndex + 1,
									),
								)
							}
							disabled={
								currentProposalIndex === proposals.length - 1
							}
							className="px-4 sm:px-6 py-2 sm:py-3 bg-primary-700 hover:bg-primary-600 disabled:bg-primary-900 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors text-sm sm:text-base"
						>
							{t("voting.next")} →
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
