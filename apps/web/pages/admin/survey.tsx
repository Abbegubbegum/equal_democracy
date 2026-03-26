import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
	BarChart3,
	Plus,
	Trash2,
	ArrowLeft,
	Play,
	Pause,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";

export default function SurveyAdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [surveys, setSurveys] = useState([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [message, setMessage] = useState("");

	// Form state for creating/editing
	const [formMode, setFormMode] = useState(null); // 'create' or 'edit'
	const [, setEditingId] = useState(null);
	const [question, setQuestion] = useState("");
	const [choices, setChoices] = useState(["", ""]);

	// Check auth
	useEffect(() => {
		if (status === "loading") return;
		if (!session) {
			router.replace("/login");
		} else if (!session.user?.isAdmin && !session.user?.isSuperAdmin) {
			router.replace("/");
		}
	}, [status, session, router]);

	// Fetch surveys
	const fetchSurveys = useCallback(async () => {
		try {
			const res = await fetch("/api/admin/survey");
			if (res.ok) {
				const data = await res.json();
				setSurveys(data);
			}
		} catch (error) {
			console.error("Error fetching surveys:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (session?.user?.isAdmin || session?.user?.isSuperAdmin) {
			fetchSurveys();
		}
	}, [session, fetchSurveys]);

	// Reset form
	const resetForm = () => {
		setFormMode(null);
		setEditingId(null);
		setQuestion("");
		setChoices(["", ""]);
		setMessage("");
	};

	// Add choice
	const addChoice = () => {
		if (choices.length < 5) {
			setChoices([...choices, ""]);
		}
	};

	// Remove choice
	const removeChoice = (index) => {
		if (choices.length > 2) {
			setChoices(choices.filter((_, i) => i !== index));
		}
	};

	// Update choice text
	const updateChoice = (index, text) => {
		const newChoices = [...choices];
		newChoices[index] = text;
		setChoices(newChoices);
	};

	// Create survey
	const handleCreate = async () => {
		if (!question.trim()) {
			setMessage("Please enter a question");
			return;
		}

		const validChoices = choices.filter((c) => c.trim());
		if (validChoices.length < 2) {
			setMessage("Please enter at least 2 choices");
			return;
		}

		setCreating(true);
		setMessage("");

		try {
			const res = await fetchWithCsrf("/api/admin/survey", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: question.trim(),
					choices: validChoices.map((text) => ({ text })),
				}),
			});

			if (res.ok) {
				setMessage("Survey created successfully!");
				resetForm();
				fetchSurveys();
			} else {
				const data = await res.json();
				setMessage(data.error || "Failed to create survey");
			}
		} catch (error) {
			console.error("Error creating survey:", error);
			setMessage("Failed to create survey");
		} finally {
			setCreating(false);
		}
	};

	// Toggle survey status
	const toggleStatus = async (survey) => {
		try {
			const newStatus = survey.status === "active" ? "closed" : "active";
			const res = await fetchWithCsrf("/api/admin/survey", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: survey._id,
					updates: { status: newStatus },
				}),
			});

			if (res.ok) {
				fetchSurveys();
			}
		} catch (error) {
			console.error("Error toggling status:", error);
		}
	};

	// Delete survey
	const handleDelete = async (id) => {
		if (!confirm("Are you sure you want to delete this survey? All votes will be lost.")) {
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/admin/survey", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id }),
			});

			if (res.ok) {
				fetchSurveys();
			}
		} catch (error) {
			console.error("Error deleting survey:", error);
		}
	};

	if (status === "loading" || loading) {
		return <div className="p-8">Loading...</div>;
	}

	if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) {
		return null;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-slate-800 text-white p-6 shadow">
				<div className="max-w-4xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-accent-400 rounded-full flex items-center justify-center">
							<BarChart3 className="w-5 h-5 text-slate-900" />
						</div>
						<div>
							<h1 className="text-2xl font-bold">Survey Management</h1>
							<p className="text-slate-300 text-sm">
								Create and manage surveys
							</p>
						</div>
					</div>
					<button
						onClick={() => router.push("/admin")}
						className="px-4 py-2 bg-white hover:bg-gray-100 text-slate-900 font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Admin
					</button>
				</div>
			</header>

			<main className="max-w-4xl mx-auto p-6 space-y-6">
				{/* Create New Survey */}
				{formMode === "create" ? (
					<div className="bg-white rounded-xl shadow-sm border p-6">
						<h2 className="text-lg font-semibold mb-4">Create New Survey</h2>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Question
								</label>
								<input
									type="text"
									value={question}
									onChange={(e) => setQuestion(e.target.value)}
									placeholder="What would you like to ask?"
									className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
									maxLength={500}
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Choices ({choices.length}/5)
								</label>
								<div className="space-y-2">
									{choices.map((choice, index) => (
										<div key={index} className="flex items-center gap-2">
											<input
												type="text"
												value={choice}
												onChange={(e) => updateChoice(index, e.target.value)}
												placeholder={`Choice ${index + 1}`}
												className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
												maxLength={200}
											/>
											{choices.length > 2 && (
												<button
													onClick={() => removeChoice(index)}
													className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											)}
										</div>
									))}
								</div>
								{choices.length < 5 && (
									<button
										onClick={addChoice}
										className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
									>
										<Plus className="w-4 h-4" />
										Add choice
									</button>
								)}
							</div>

							{message && (
								<div className={`p-3 rounded-lg text-sm ${
									message.includes("success")
										? "bg-green-50 text-green-700"
										: "bg-red-50 text-red-700"
								}`}>
									{message}
								</div>
							)}

							<div className="flex justify-end gap-2">
								<button
									onClick={resetForm}
									className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
								>
									Cancel
								</button>
								<button
									onClick={handleCreate}
									disabled={creating}
									className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
								>
									{creating ? "Creating..." : "Create Survey"}
								</button>
							</div>
						</div>
					</div>
				) : (
					<button
						onClick={() => setFormMode("create")}
						className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
					>
						<Plus className="w-5 h-5" />
						Create New Survey
					</button>
				)}

				{/* Existing Surveys */}
				<div className="space-y-4">
					<h2 className="text-lg font-semibold">Existing Surveys</h2>

					{surveys.length === 0 ? (
						<div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
							No surveys yet. Create your first survey above.
						</div>
					) : (
						surveys.map((survey) => (
							<div
								key={survey._id}
								className="bg-white rounded-xl shadow-sm border overflow-hidden"
							>
								<div className="p-4 border-b flex items-center justify-between">
									<div className="flex items-center gap-3">
										<span
											className={`px-2 py-1 rounded-full text-xs font-medium ${
												survey.status === "active"
													? "bg-green-100 text-green-700"
													: "bg-gray-100 text-gray-600"
											}`}
										>
											{survey.status}
										</span>
										<h3 className="font-semibold text-gray-800">
											{survey.question}
										</h3>
									</div>
									<div className="flex items-center gap-2">
										<button
											onClick={() => toggleStatus(survey)}
											className={`p-2 rounded-lg transition-colors ${
												survey.status === "active"
													? "text-yellow-600 hover:bg-yellow-50"
													: "text-green-600 hover:bg-green-50"
											}`}
											title={survey.status === "active" ? "Close survey" : "Activate survey"}
										>
											{survey.status === "active" ? (
												<Pause className="w-4 h-4" />
											) : (
												<Play className="w-4 h-4" />
											)}
										</button>
										<button
											onClick={() => handleDelete(survey._id)}
											className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
											title="Delete survey"
										>
											<Trash2 className="w-4 h-4" />
										</button>
									</div>
								</div>

								<div className="p-4 space-y-2">
									{survey.choices.map((choice) => {
										const percentage = survey.totalVotes > 0
											? Math.round((choice.voteCount / survey.totalVotes) * 100)
											: 0;

										return (
											<div
												key={choice.id}
												className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
											>
												<span className="text-gray-700">{choice.text}</span>
												<div className="flex items-center gap-3 text-sm">
													<span className="text-gray-500">
														{choice.voteCount || 0} votes
													</span>
													<div className="w-24 bg-gray-200 rounded-full h-2">
														<div
															className="bg-primary-500 h-2 rounded-full transition-all"
															style={{ width: `${percentage}%` }}
														/>
													</div>
													<span className="text-gray-600 w-10 text-right">
														{percentage}%
													</span>
												</div>
											</div>
										);
									})}
								</div>

								<div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500 flex items-center justify-between">
									<span>
										Total: {survey.totalVotes || 0} votes
									</span>
									<span>
										Created: {new Date(survey.createdAt).toLocaleDateString()}
									</span>
								</div>
							</div>
						))
					)}
				</div>
			</main>
		</div>
	);
}
