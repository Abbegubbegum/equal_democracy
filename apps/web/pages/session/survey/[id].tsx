import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import {
	Users,
	Plus,
	ThumbsUp,
	TrendingUp,
	Clock,
	Star,
	ArrowLeft,
} from "lucide-react";
import { fetchWithCsrf } from "../../../lib/fetch-with-csrf";
import { useTranslation } from "../../../lib/hooks/useTranslation";
import { useConfig } from "../../../lib/contexts/ConfigContext";
import useSSE from "../../../lib/hooks/useSSE";
import { useLazySound } from "../../../lib/hooks/useLazySound";

export default function SurveySessionPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { id: sessionId } = router.query;
	const { t } = useTranslation();
	const { theme } = useConfig();
	const [proposals, setProposals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState("home"); // 'home', 'create'
	const [placeName, setPlaceName] = useState("");
	const [expandedRating, setExpandedRating] = useState(null);
	const [hasActiveSession, setHasActiveSession] = useState(true);
	const [showUserCount, setShowUserCount] = useState(false);
	const [archiveDate, setArchiveDate] = useState(null);

	// Dynamic theme colors
	const primaryColor = theme.colors?.primary?.[600] || "#002d75";
	const accentColor = theme.colors?.accent?.[400] || "#f8b60e";
	const primaryDark = theme.colors?.primary?.[800] || "#001c55";

	// Sound effects (lazy-loaded to reduce initial bundle)
	const [playNotification] = useLazySound("/sounds/notification.mp3", {
		volume: 0.5,
	});

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
				`/api/sessions/current?sessionId=${sessionId}`
			);
			const data = await res.json();

			if (data.noActiveSession) {
				setHasActiveSession(false);
				setPlaceName("");
				setLoading(false);
				return;
			}

			// Redirect to standard session page if not a survey
			if (data.sessionType && data.sessionType !== "survey") {
				router.replace(`/session/${sessionId}`);
				return;
			}

			setHasActiveSession(true);

			if (data.place) {
				setPlaceName(data.place);
			}

			if (data.showUserCount !== undefined) {
				setShowUserCount(data.showUserCount);
			}

			if (data.archiveDate) {
				setArchiveDate(new Date(data.archiveDate));
			}
		} catch (error) {
			console.error("Error fetching session info:", error);
			setLoading(false);
		}
	}, [sessionId, router]);

	// Setup SSE for real-time updates
	const { activeUserCount } = useSSE({
		onNewProposal: (proposal) => {
			if (proposal.sessionId === sessionId) {
				setProposals((prev) => [proposal, ...prev]);
				playNotification();
			}
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
						: p
				)
			);
		},
		onSessionArchived: (archivedData) => {
			if (archivedData.sessionId === sessionId) {
				// Redirect to archive page when session is archived
				router.push(`/archive/${sessionId}`);
			}
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
		}
	}, [session, sessionId, fetchProposals, fetchSessionInfo]);

	// Light polling as backup
	useEffect(() => {
		if (!session || !sessionId) {
			return;
		}

		const pollInterval = setInterval(() => {
			fetchSessionInfo();
			fetchProposals();
		}, 60000);

		return () => {
			clearInterval(pollInterval);
		};
	}, [session, sessionId, fetchSessionInfo, fetchProposals]);

	const handleCreateProposal = async (title) => {
		try {
			const res = await fetchWithCsrf("/api/proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					problem: "",
					solution: "",
					sessionId,
				}),
			});

			if (res.ok) {
				setView("home");
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error creating proposal:", error);
			alert("An error occurred while creating the response");
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
			} else {
				const data = await res.json();
				alert(data.message);
			}
		} catch (error) {
			console.error("Error voting:", error);
		}
	};

	if (status === "loading" || loading) {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center">
				<div className="text-xl text-gray-600">
					{t("common.loading") || "Loading..."}
				</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	// Render create view
	if (view === "create") {
		return (
			<CreateResponseView
				onSubmit={handleCreateProposal}
				onBack={() => setView("home")}
				t={t}
			/>
		);
	}

	// Home view - sort proposals by rating
	const sortedProposals = [...proposals]
		.filter((p) => p.status === "active")
		.sort((a, b) => {
			if (b.averageRating !== a.averageRating) {
				return (b.averageRating || 0) - (a.averageRating || 0);
			}
			return (b.thumbsUpCount || 0) - (a.thumbsUpCount || 0);
		});

	return (
		<div className="min-h-screen bg-gray-50 overflow-x-hidden">
			{/* Header */}
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
										{activeUserCount}{" "}
										{t("sessions.activeUsers") || "active"}
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

				{/* Add response button */}
				{hasActiveSession && (
					<button
						onClick={() => setView("create")}
						className="w-full font-bold py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105"
						style={{
							backgroundColor: accentColor,
							color: primaryDark,
						}}
					>
						<Plus className="w-6 h-6" />
						{t("ranking.addResponse") || "Add your response"}
					</button>
				)}

				{/* Ranking countdown banner */}
				{hasActiveSession && archiveDate && (
					<SurveyCountdownBanner
						archiveDate={archiveDate}
						t={t}
						primaryColor={primaryColor}
					/>
				)}

				{/* Rankings */}
				{hasActiveSession && (
					<div className="space-y-4">
						<h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
							<TrendingUp className="w-5 h-5" />
							{t("ranking.liveRankings") || "Live Rankings"} (
							{sortedProposals.length})
						</h3>

						{sortedProposals.length === 0 ? (
							<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
								<p>
									{t("ranking.noResponses") ||
										"No responses yet. Be the first to respond!"}
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{sortedProposals.map((proposal, index) => (
									<SurveyResponseCard
										key={proposal._id}
										proposal={proposal}
										rank={index + 1}
										expandedRating={expandedRating}
										setExpandedRating={setExpandedRating}
										onThumbsUp={handleThumbsUp}
										t={t}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// RANKING COUNTDOWN BANNER COMPONENT
// ============================================================================

function SurveyCountdownBanner({ archiveDate, t, primaryColor }) {
	const [timeRemaining, setTimeRemaining] = useState("");
	const [isExpired, setIsExpired] = useState(false);

	useEffect(() => {
		const updateCountdown = () => {
			const now = new Date();
			const archive = new Date(archiveDate);
			const diff = archive - now;

			if (diff <= 0) {
				setIsExpired(true);
				setTimeRemaining(t("ranking.rankingEnded") || "Ranking ended");
				return;
			}

			const days = Math.floor(diff / (1000 * 60 * 60 * 24));
			const hours = Math.floor(
				(diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
			);
			const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

			if (days > 0) {
				setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
			} else if (hours > 0) {
				setTimeRemaining(`${hours}h ${minutes}m`);
			} else {
				setTimeRemaining(`${minutes}m`);
			}
		};

		updateCountdown();
		const interval = setInterval(updateCountdown, 60000); // Update every minute

		return () => clearInterval(interval);
	}, [archiveDate, t]);

	return (
		<div
			className={`rounded-2xl p-4 sm:p-6 shadow-md ${
				isExpired
					? "bg-gray-100 border-2 border-gray-300"
					: "bg-primary-50 border-2 border-primary-300"
			}`}
		>
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div
						className="w-10 h-10 rounded-full flex items-center justify-center"
						style={{
							backgroundColor: isExpired
								? "#6b7280"
								: primaryColor,
						}}
					>
						<Clock className="w-5 h-5 text-white" />
					</div>
					<div>
						<p
							className={`font-semibold ${isExpired ? "text-gray-700" : "text-primary-800"}`}
						>
							{isExpired
								? t("ranking.rankingEnded") || "Ranking ended"
								: t("ranking.timeRemaining") ||
									"Time remaining"}
						</p>
						<p
							className={`text-sm ${isExpired ? "text-gray-500" : "text-primary-600"}`}
						>
							{t("ranking.resultsArchived") ||
								"Results will be archived when time expires"}
						</p>
					</div>
				</div>
				{!isExpired && (
					<div
						className="text-white px-4 py-2 rounded-xl font-bold text-lg"
						style={{ backgroundColor: primaryColor }}
					>
						{timeRemaining}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// RANKING RESPONSE CARD COMPONENT
// ============================================================================

function SurveyResponseCard({
	proposal,
	rank,
	expandedRating,
	setExpandedRating,
	onThumbsUp,
	t,
}) {
	const [hasVoted, setHasVoted] = useState(false);
	const [checking, setChecking] = useState(true);
	const [userRating, setUserRating] = useState(0);
	const [confirmedRating, setConfirmedRating] = useState(0);
	const [showConfirmation, setShowConfirmation] = useState(false);

	const isExpanded = expandedRating === proposal._id;

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

	useEffect(() => {
		checkIfVoted();
	}, [proposal._id, checkIfVoted]);

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

	// Determine medal/rank styling
	const getRankStyle = () => {
		if (rank === 1)
			return {
				bg: "bg-yellow-100",
				border: "border-yellow-400",
				text: "text-yellow-700",
				badge: "bg-yellow-500",
			};
		if (rank === 2)
			return {
				bg: "bg-gray-100",
				border: "border-gray-400",
				text: "text-gray-700",
				badge: "bg-gray-400",
			};
		if (rank === 3)
			return {
				bg: "bg-orange-100",
				border: "border-orange-400",
				text: "text-orange-700",
				badge: "bg-orange-500",
			};
		return {
			bg: "bg-white",
			border: "border-gray-200",
			text: "text-gray-600",
			badge: "bg-gray-300",
		};
	};

	const rankStyle = getRankStyle();

	return (
		<div
			className={`${rankStyle.bg} border-2 ${rankStyle.border} rounded-2xl shadow-md p-4 sm:p-5 transition-all`}
		>
			<div className="flex items-start gap-4">
				{/* Rank badge */}
				<div
					className={`${rankStyle.badge} w-10 h-10 rounded-full flex items-center justify-center shrink-0`}
				>
					<span className="text-white font-bold text-lg">{rank}</span>
				</div>

				{/* Response content */}
				<div className="flex-1 min-w-0">
					<h4
						className={`text-lg font-bold ${rankStyle.text} mb-2 wrap-break-word`}
					>
						{proposal.title}
					</h4>

					{/* Rating display */}
					<div className="flex flex-wrap items-center gap-3 mb-3">
						<div className="flex items-center gap-1">
							{[1, 2, 3, 4, 5].map((star) => (
								<Star
									key={star}
									className={`w-4 h-4 ${
										star <=
										Math.round(proposal.averageRating || 0)
											? "fill-yellow-400 text-yellow-400"
											: "text-gray-300"
									}`}
								/>
							))}
							<span className="ml-1 text-sm font-semibold text-gray-700">
								{(proposal.averageRating || 0).toFixed(1)}
							</span>
						</div>
						<span className="text-xs text-gray-500">
							({proposal.thumbsUpCount || 0}{" "}
							{t("ranking.ratings") || "ratings"})
						</span>
					</div>

					{/* Rate button */}
					<div>
						<button
							onClick={() =>
								setExpandedRating(
									isExpanded ? null : proposal._id
								)
							}
							disabled={checking}
							className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
								hasVoted
									? "bg-primary-100 text-primary-600"
									: "bg-gray-100 hover:bg-primary-100 text-gray-700 hover:text-primary-600"
							}`}
						>
							<ThumbsUp className="w-4 h-4" />
							<span>
								{hasVoted
									? t("rating.changeRating")
									: t("rating.giveRating")}
							</span>
						</button>

						{hasVoted && userRating > 0 && !isExpanded && (
							<div className="mt-2 flex items-center gap-2 px-2 py-1 bg-primary-50 rounded-lg inline-flex">
								<span className="text-xs text-primary-800 font-medium">
									{t("rating.yourRating")}:
								</span>
								<div className="flex gap-0.5">
									{[1, 2, 3, 4, 5].map((star) => (
										<Star
											key={star}
											className={`w-4 h-4 ${
												star <= userRating
													? "fill-primary-500 text-primary-500"
													: "text-gray-300"
											}`}
										/>
									))}
								</div>
							</div>
						)}

						{isExpanded && (
							<div className="mt-2 flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
								{[1, 2, 3, 4, 5].map((star) => {
									const isConfirmed =
										showConfirmation &&
										star <= confirmedRating;
									return (
										<button
											key={star}
											onClick={() =>
												handleStarClick(star)
											}
											className="transition-transform hover:scale-125"
										>
											<Star
												className={`w-7 h-7 ${
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
								<span className="ml-2 text-xs text-gray-600">
									{showConfirmation
										? t("rating.ratingRegistered", {
												rating: confirmedRating,
											})
										: t("rating.clickStar")}
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// CREATE RESPONSE VIEW
// ============================================================================

function CreateResponseView({ onSubmit, onBack, t }) {
	const [title, setTitle] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (title.trim()) {
			setSubmitting(true);
			await onSubmit(title.trim());
			setSubmitting(false);
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
						{t("ranking.addResponse") || "Add your response"}
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

						<button
							type="submit"
							disabled={!title.trim() || submitting}
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
