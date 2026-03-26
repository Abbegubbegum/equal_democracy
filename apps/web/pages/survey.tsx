import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { CheckCircle, RefreshCw, BarChart3, ArrowLeft } from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useTranslation } from "../lib/hooks/useTranslation";

// Generate or retrieve a persistent visitor ID
function getVisitorId() {
	if (typeof window === "undefined") return null;

	let visitorId = localStorage.getItem("survey_visitor_id");
	if (!visitorId) {
		visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
		localStorage.setItem("survey_visitor_id", visitorId);
	}
	return visitorId;
}

export default function SurveyPage() {
	const router = useRouter();
	const { t } = useTranslation();
	const [survey, setSurvey] = useState(null);
	const [loading, setLoading] = useState(true);
	const [selectedChoice, setSelectedChoice] = useState(null);
	const [userVote, setUserVote] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState("");
	const [visitorId, setVisitorId] = useState(null);

	// Get visitor ID on mount
	useEffect(() => {
		setVisitorId(getVisitorId());
	}, []);

	// Fetch survey data
	const fetchSurvey = useCallback(async () => {
		if (!visitorId) return;

		try {
			const res = await fetch(`/api/survey?visitorId=${encodeURIComponent(visitorId)}`);
			const data = await res.json();

			if (data.survey) {
				setSurvey(data.survey);
				if (data.userVote) {
					setUserVote(data.userVote);
					setSelectedChoice(data.userVote);
				}
			} else {
				setSurvey(null);
			}
		} catch (error) {
			console.error("Error fetching survey:", error);
			setMessage("Failed to load survey");
		} finally {
			setLoading(false);
		}
	}, [visitorId]);

	useEffect(() => {
		if (visitorId) {
			fetchSurvey();
		}
	}, [visitorId, fetchSurvey]);

	// Submit or update vote
	const handleVote = async () => {
		if (!selectedChoice || !survey || !visitorId) return;

		setSubmitting(true);
		setMessage("");

		try {
			const res = await fetchWithCsrf("/api/survey", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					surveyId: survey._id,
					choiceId: selectedChoice,
					visitorId,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				setUserVote(selectedChoice);
				setMessage(userVote ? "Vote updated!" : "Vote submitted!");
				// Refresh to get updated counts
				fetchSurvey();
			} else {
				setMessage(data.error || "Failed to submit vote");
			}
		} catch (error) {
			console.error("Error submitting vote:", error);
			setMessage("Failed to submit vote");
		} finally {
			setSubmitting(false);
		}
	};

	// Calculate total votes and percentages
	const totalVotes = survey?.choices?.reduce((sum, c) => sum + (c.voteCount || 0), 0) || 0;

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-gray-500">{t("common.loading") || "Loading..."}</div>
			</div>
		);
	}

	if (!survey) {
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="max-w-2xl mx-auto p-6">
					<button
						onClick={() => router.push("/")}
						className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						{t("common.backToHome") || "Back to home"}
					</button>

					<div className="bg-white rounded-2xl shadow-lg p-8 text-center">
						<BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
						<h1 className="text-2xl font-bold text-gray-800 mb-2">{t("poll.noActivePoll") || "No Active Poll"}</h1>
						<p className="text-gray-600">
							{t("poll.checkBackLater") || "There is no poll available at the moment. Please check back later."}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="max-w-2xl mx-auto p-6">
				<button
					onClick={() => router.push("/")}
					className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
				>
					<ArrowLeft className="w-4 h-4" />
					{t("common.backToHome") || "Back to home"}
				</button>

				<div className="bg-white rounded-2xl shadow-lg overflow-hidden">
					{/* Header */}
					<div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white">
						<div className="flex items-center gap-3 mb-2">
							<BarChart3 className="w-6 h-6" />
							<span className="text-sm font-medium opacity-90">{t("poll.poll") || "Poll"}</span>
						</div>
						<h1 className="text-2xl font-bold">{survey.question}</h1>
					</div>

					{/* Choices */}
					<div className="p-6 space-y-3">
						{survey.choices.map((choice) => {
							const percentage = totalVotes > 0
								? Math.round((choice.voteCount / totalVotes) * 100)
								: 0;
							const isSelected = selectedChoice === choice.id;
							const isUserVote = userVote === choice.id;
							const showResults = !!userVote;

							return (
								<button
									key={choice.id}
									onClick={() => setSelectedChoice(choice.id)}
									className={`w-full p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden ${
										isSelected
											? "border-primary-500 bg-primary-50"
											: "border-gray-200 hover:border-gray-300 bg-white"
									}`}
								>
									{/* Background bar for vote percentage - only show after voting */}
									{showResults && totalVotes > 0 && (
										<div
											className={`absolute inset-0 transition-all ${
												isSelected ? "bg-primary-100" : "bg-gray-100"
											}`}
											style={{ width: `${percentage}%` }}
										/>
									)}

									<div className="relative flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div
												className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
													isSelected
														? "border-primary-500 bg-primary-500"
														: "border-gray-300"
												}`}
											>
												{isSelected && (
													<CheckCircle className="w-4 h-4 text-white" />
												)}
											</div>
											<span className={`font-medium ${isSelected ? "text-primary-700" : "text-gray-700"}`}>
												{choice.text}
											</span>
											{isUserVote && (
												<span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">
													{t("poll.yourVote") || "Your vote"}
												</span>
											)}
										</div>
										{/* Only show vote counts after user has voted */}
										{showResults && (
											<div className="flex items-center gap-2 text-sm">
												<span className={isSelected ? "text-primary-600" : "text-gray-500"}>
													{choice.voteCount || 0} {t("poll.votes") || "votes"}
												</span>
												{totalVotes > 0 && (
													<span className={`font-medium ${isSelected ? "text-primary-700" : "text-gray-600"}`}>
														({percentage}%)
													</span>
												)}
											</div>
										)}
									</div>
								</button>
							);
						})}
					</div>

					{/* Footer */}
					<div className="px-6 pb-6 space-y-4">
						{message && (
							<div className={`p-3 rounded-lg text-sm ${
								message.includes("Failed") || message.includes("error")
									? "bg-red-50 text-red-700"
									: "bg-green-50 text-green-700"
							}`}>
								{message}
							</div>
						)}

						<div className="flex items-center justify-between">
							{userVote ? (
								<div className="text-sm text-gray-500">
									{totalVotes} {t("poll.totalVotes") || "total votes"}
								</div>
							) : (
								<div className="text-sm text-gray-500">
									{t("poll.selectToSeeResults") || "Select an option and submit to see results"}
								</div>
							)}

							<div className="flex items-center gap-2">
								{userVote && (
									<button
										onClick={fetchSurvey}
										className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
										title={t("poll.refreshResults") || "Refresh results"}
									>
										<RefreshCw className="w-5 h-5" />
									</button>
								)}

								<button
									onClick={handleVote}
									disabled={!selectedChoice || submitting || selectedChoice === userVote}
									className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
										!selectedChoice || submitting || selectedChoice === userVote
											? "bg-gray-200 text-gray-500 cursor-not-allowed"
											: "bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg"
									}`}
								>
									{submitting
										? (t("poll.submitting") || "Submitting...")
										: userVote
											? (t("poll.updateVote") || "Update Vote")
											: (t("poll.submitVote") || "Submit Vote")}
								</button>
							</div>
						</div>

						{userVote && (
							<p className="text-xs text-gray-500 text-center">
								{t("poll.canChangeVote") || "You can change your vote at any time while the poll is active."}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
