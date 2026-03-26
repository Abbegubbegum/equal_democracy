import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Star, Users, Calendar, TrendingUp } from "lucide-react";
import { useTranslation } from "../../lib/hooks/useTranslation";
import { useConfig } from "../../lib/contexts/ConfigContext";

export default function ArchivedSessionPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { id: sessionId } = router.query;
	const { t } = useTranslation();
	const { theme } = useConfig();
	const [loading, setLoading] = useState(true);
	const [archivedSession, setArchivedSession] = useState(null);
	const [proposals, setProposals] = useState([]);

	const fetchArchivedSession = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch(`/api/sessions/archived/${sessionId}`);
			if (res.ok) {
				const data = await res.json();
				setArchivedSession(data.session);
				setProposals(data.proposals || []);
			} else {
				console.error("Failed to fetch archived session");
			}
		} catch (error) {
			console.error("Error fetching archived session:", error);
		} finally {
			setLoading(false);
		}
	}, [sessionId]);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	useEffect(() => {
		if (session && sessionId) {
			fetchArchivedSession();
		}
	}, [session, sessionId, fetchArchivedSession]);

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

	if (!archivedSession) {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center">
				<div className="text-center">
					<p className="text-xl text-gray-600 mb-4">
						{t("archive.notFound") || "Archived session not found"}
					</p>
					<button
						onClick={() => router.push("/")}
						className="bg-primary-800 hover:bg-primary-900 text-white font-bold py-3 px-8 rounded-xl transition-colors"
					>
						{t("common.back") || "Back"}
					</button>
				</div>
			</div>
		);
	}

	const primaryColor = theme.colors?.primary?.[600] || "#002d75";
	const accentColor = theme.colors?.accent?.[400] || "#f8b60e";
	const primaryDark = theme.colors?.primary?.[800] || "#001c55";

	const formatDate = (dateString) => {
		if (!dateString) return "";
		const date = new Date(dateString);
		return date.toLocaleDateString("sv-SE", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	// Get medal style based on rank
	const getMedalStyle = (rank) => {
		if (rank === 1)
			return {
				bg: "bg-yellow-100",
				border: "border-yellow-400",
				badge: "bg-yellow-500",
				text: "text-yellow-700",
			};
		if (rank === 2)
			return {
				bg: "bg-gray-100",
				border: "border-gray-400",
				badge: "bg-gray-400",
				text: "text-gray-700",
			};
		if (rank === 3)
			return {
				bg: "bg-orange-100",
				border: "border-orange-400",
				badge: "bg-orange-500",
				text: "text-orange-700",
			};
		return {
			bg: "bg-white",
			border: "border-gray-200",
			badge: "bg-gray-300",
			text: "text-gray-600",
		};
	};

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<div
				className="text-white p-4 sm:p-6 shadow-lg"
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
								<div className="flex items-center gap-2 mb-1">
									<span
										className="px-2 py-0.5 text-xs font-medium rounded-full"
										style={{
											backgroundColor: accentColor,
											color: primaryDark,
										}}
									>
										{t("archive.archived") || "Archived"}
									</span>
								</div>
								<h1 className="text-xl sm:text-2xl font-bold wrap-break-word">
									{archivedSession.place}
								</h1>
							</div>
						</div>
					</div>

					{/* Session metadata */}
					<div className="flex flex-wrap items-center gap-4 text-primary-100 text-sm">
						<span className="flex items-center gap-1">
							<Calendar className="w-4 h-4" />
							{formatDate(archivedSession.startDate)} -{" "}
							{formatDate(archivedSession.endDate)}
						</span>
						{archivedSession.participantCount > 0 && (
							<span className="flex items-center gap-1">
								<Users className="w-4 h-4" />
								{archivedSession.participantCount}{" "}
								{t("archive.participants") || "participants"}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Results section */}
			<div className="max-w-4xl mx-auto p-4 sm:p-6">
				{/* Rankings */}
				<div className="bg-white rounded-2xl shadow-md p-6">
					<div className="flex items-center gap-3 mb-6">
						<TrendingUp className="w-6 h-6 text-primary-600" />
						<h2 className="text-xl font-bold text-gray-800">
							{t("archive.finalRankings") || "Final Rankings"}
						</h2>
					</div>

					{proposals.length === 0 ? (
						<p className="text-center text-gray-500 py-8">
							{t("archive.noResponses") ||
								"No responses were submitted for this ranking."}
						</p>
					) : (
						<div className="space-y-3">
							{proposals.map((proposal, index) => {
								const rank = index + 1;
								const style = getMedalStyle(rank);

								return (
									<div
										key={proposal._id}
										className={`${style.bg} border-2 ${style.border} rounded-xl p-4 transition-all`}
									>
										<div className="flex items-center gap-4">
											{/* Rank badge */}
											<div
												className={`${style.badge} w-10 h-10 rounded-full flex items-center justify-center shrink-0`}
											>
												<span className="text-white font-bold text-lg">
													{rank}
												</span>
											</div>

											{/* Response content */}
											<div className="flex-1 min-w-0">
												<h4
													className={`font-bold ${style.text} wrap-break-word`}
												>
													{proposal.title}
												</h4>
											</div>

											{/* Rating */}
											<div className="flex items-center gap-2 shrink-0">
												<div className="flex items-center gap-0.5">
													{[1, 2, 3, 4, 5].map(
														(star) => (
															<Star
																key={star}
																className={`w-4 h-4 ${
																	star <=
																	Math.round(
																		proposal.averageRating ||
																			0
																	)
																		? "fill-yellow-400 text-yellow-400"
																		: "text-gray-300"
																}`}
															/>
														)
													)}
												</div>
												<span className="font-semibold text-gray-700">
													{(
														proposal.averageRating ||
														0
													).toFixed(2)}
												</span>
												<span className="text-xs text-gray-500">
													(
													{proposal.thumbsUpCount ||
														0}
													)
												</span>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Back button */}
				<div className="mt-6 text-center">
					<button
						onClick={() => router.push("/")}
						className="bg-primary-800 hover:bg-primary-900 text-white font-bold py-3 px-8 rounded-xl transition-colors"
					>
						{t("common.backToHome") || "Back to Home"}
					</button>
				</div>
			</div>
		</div>
	);
}
