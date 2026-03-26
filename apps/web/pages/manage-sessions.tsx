import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Calendar, ArrowLeft, Radio, Minus, Plus } from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useConfig } from "../lib/contexts/ConfigContext";
import { useTranslation } from "../lib/hooks/useTranslation";
import useSSE from "../lib/hooks/useSSE";

export default function ManageSessionsPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { theme } = useConfig();
	const { t } = useTranslation();

	useEffect(() => {
		if (status === "loading") return;
		if (!session) router.replace("/login");
		else if (!session.user?.isAdmin && !session.user?.isSuperAdmin)
			router.replace("/");
	}, [status, session, router]);

	if (status === "loading") return <div className="p-8">Loading…</div>;
	if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) return null;

	const primaryColor = theme?.primaryColor || "#00236a";
	const primaryDark = theme?.primaryDark || "#001440";
	const accentColor = theme?.accentColor || "#fbbf24";

	return (
		<div className="min-h-screen bg-gray-50">
			<header
				className="text-white p-4 sm:p-6 shadow-lg"
				style={{
					background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
				}}
			>
				<div className="max-w-4xl mx-auto">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
						<div className="flex items-center gap-3">
							<div
								className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
								style={{ backgroundColor: accentColor }}
							>
								<Calendar
									className="w-6 h-6"
									style={{ color: primaryDark }}
								/>
							</div>
							<div className="min-w-0">
								<h1 className="text-xl sm:text-2xl font-bold wrap-break-word">
									{t("nav.manageSessions") ||
										"Manage Sessions"}
								</h1>
								<p className="text-primary-100 text-xs sm:text-sm wrap-break-word">
									{t("manageSessions.subtitle") ||
										"Create and manage democracy sessions"}
								</p>
							</div>
						</div>
						<button
							onClick={() => router.push("/")}
							className="text-white hover:opacity-80 font-medium whitespace-nowrap flex items-center gap-2 text-sm"
						>
							<ArrowLeft className="w-4 h-4" />
							{t("common.backToHome") || "Back to home"}
						</button>
					</div>
				</div>
			</header>

			<main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
				<SessionsPanel />
			</main>
		</div>
	);
}

function SessionsPanel() {
	const { data: session } = useSession();
	const { theme } = useConfig();
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [newPlace, setNewPlace] = useState("");
	const [maxOneProposalPerUser, setMaxOneProposalPerUser] = useState(false);
	const [showUserCount, setShowUserCount] = useState(false);
	const [noMotivation, setNoMotivation] = useState(false);
	const [singleResult, setSingleResult] = useState(false);
	const [onlyYesVotes, setOnlyYesVotes] = useState(false);
	const [sessionType, setSessionType] = useState("standard"); // "standard" or "survey"
	const [surveyDurationDays, setSurveyDurationDays] = useState("6");
	const [message, setMessage] = useState("");
	const [remainingSessions, setRemainingSessions] = useState(null);
	const [requestedSessions, setRequestedSessions] = useState("10");
	const [language, setLanguage] = useState("sv");
	const [themeValue, setThemeValue] = useState("default");
	const [, setSettingsLoaded] = useState(false);

	const accentColor = theme?.accentColor || "#fbbf24";
	const primaryDark = theme?.primaryDark || "#001440";

	const loadSessions = useCallback(async () => {
		setLoading(true);
		try {
			// First, check if there's any active session (regardless of creator)
			const activeSessionRes = await fetch("/api/sessions/current");
			let globalActiveSession = null;
			if (activeSessionRes.ok) {
				const activeSessionData = await activeSessionRes.json();
				if (activeSessionData && activeSessionData._id) {
					globalActiveSession = activeSessionData;
				}
			}

			// Then load sessions filtered by creator (for regular admins)
			const res = await fetch("/api/admin/sessions");
			if (res.ok) {
				const data = await res.json();
				const sessionsData = Array.isArray(data) ? data : [];

				// If there's a global active session not in our list, add it with limited info
				if (
					globalActiveSession &&
					!sessionsData.some((s) => s._id === globalActiveSession._id)
				) {
					sessionsData.unshift({
						_id: globalActiveSession._id,
						place: globalActiveSession.place,
						status: globalActiveSession.status,
						phase: globalActiveSession.phase,
						startDate: globalActiveSession.startDate,
						createdBy: "other", // Mark as created by someone else
						isOtherUserSession: true,
					});
				}

				setSessions(sessionsData);
			} else {
				console.error("Error loading sessions:", res.status);
				setSessions([]);
			}
		} catch (error) {
			console.error("Error loading sessions:", error);
			setSessions([]);
		}
		setLoading(false);
	}, []);

	const loadSessionLimit = useCallback(async () => {
		try {
			const res = await fetch("/api/admin/session-limit");
			if (res.ok) {
				const data = await res.json();
				setRemainingSessions(data.remaining);
			}
		} catch (error) {
			console.error("Error loading session limit:", error);
		}
	}, []);

	const loadSettings = useCallback(async () => {
		try {
			const res = await fetch("/api/settings");
			if (res.ok) {
				const data = await res.json();
				setLanguage(data.language || "sv");
				setThemeValue(data.theme || "default");
				setSettingsLoaded(true);
			} else {
				console.error("Error loading settings:", res.status);
			}
		} catch (error) {
			console.error("Error loading settings:", error);
		}
	}, []);

	useEffect(() => {
		loadSessions(); // eslint-disable-line react-hooks/set-state-in-effect
		loadSessionLimit();
		loadSettings();
		setNewPlace("Write a short question max eight words here");
	}, [loadSessions, loadSessionLimit, loadSettings]);

	const saveSettings = async () => {
		try {
			const res = await fetchWithCsrf("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					language,
					theme: themeValue,
				}),
			});

			if (res.ok) {
				// Settings saved successfully, will reload page after session creation
				return true;
			} else {
				const error = await res.json();
				console.error("Error saving settings:", error);
				return false;
			}
		} catch (error) {
			console.error("Error saving settings:", error);
			return false;
		}
	};

	const createSession = async () => {
		if (!newPlace) {
			setMessage("Place required");
			return;
		}

		// Warn user if this is their last session
		if (!session?.user?.isSuperAdmin && remainingSessions === 1) {
			const confirmed = confirm(
				"Warning: This is your last available session. After creating this session, you will need to request more sessions from a superadmin to create additional sessions. Do you want to continue?"
			);
			if (!confirmed) {
				return;
			}
		}

		setCreating(true);
		setMessage("");

		try {
			// Save settings first
			const settingsSaved = await saveSettings();

			const res = await fetchWithCsrf("/api/admin/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					place: newPlace,
					maxOneProposalPerUser: maxOneProposalPerUser,
					showUserCount: showUserCount,
					noMotivation: noMotivation,
					singleResult: singleResult,
					onlyYesVotes: onlyYesVotes,
					sessionType: sessionType,
					surveyDurationDays:
						sessionType === "survey"
							? parseInt(surveyDurationDays)
							: undefined,
				}),
			});

			if (res.ok) {
				const data = await res.json();
				if (data.isLastSession) {
					setMessage(
						"Session created! This was your last available session. You can request more sessions below."
					);
				} else {
					setMessage("Session created!");
				}

				// Reload page to apply new settings if they were saved
				if (settingsSaved) {
					setTimeout(() => {
						window.location.reload();
					}, 1500);
				} else {
					loadSessions();
					loadSessionLimit();
					setNewPlace("Write a short question max eight words here");
					setMaxOneProposalPerUser(false);
					setOnlyYesVotes(false);
					setSessionType("standard");
					setSurveyDurationDays("6");
					setTimeout(
						() => setMessage(""),
						data.isLastSession ? 5000 : 3000
					);
				}
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error creating session:", error);
			setMessage("Could not create session");
		}

		setCreating(false);
	};

	const requestMoreSessions = async () => {
		const numSessions = parseInt(requestedSessions);
		if (isNaN(numSessions) || numSessions < 1 || numSessions > 50) {
			alert("Please enter a number between 1 and 50");
			return;
		}

		try {
			const res = await fetchWithCsrf(
				"/api/admin/request-more-sessions",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ requestedSessions: sessions }),
				}
			);

			if (res.ok) {
				alert(
					"Your request for more sessions has been submitted. A superadmin will review it shortly."
				);
				setRequestedSessions("10");
			} else {
				const error = await res.json();
				alert(`Error: ${error.message}`);
			}
		} catch (error) {
			console.error("Error requesting more sessions:", error);
			alert("Could not submit request");
		}
	};

	const closeSession = async (sessionId) => {
		if (
			!confirm(
				"Are you sure you want to close this session? All proposals will be archived and winning proposals moved to top proposals."
			)
		) {
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/admin/close-session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId }),
			});

			if (res.ok) {
				const data = await res.json();
				alert(
					`Session closed! ${data.topProposals.length} top proposals saved.`
				);
				loadSessions();
			} else {
				const error = await res.json();
				alert(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error closing session:", error);
			alert("Could not close session");
		}
	};

	const archiveSession = async (sessionId) => {
		if (
			!confirm(
				"Are you sure you want to archive this ranking? The current rankings will be preserved and visible in the archive section."
			)
		) {
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/admin/archive-session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId }),
			});

			if (res.ok) {
				alert(
					"Ranking archived successfully! Results are now available in the archive section."
				);
				loadSessions();
			} else {
				const error = await res.json();
				alert(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error archiving session:", error);
			alert("Could not archive session");
		}
	};

	if (loading)
		return (
			<div className="p-6 bg-white rounded-2xl shadow-lg">Loading…</div>
		);

	const activeSessions = sessions.filter((s) => s.status === "active");
	const closedSessions = sessions.filter((s) => s.status === "closed");

	return (
		<div className="space-y-6">
			{!session?.user?.isSuperAdmin && (
				<div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
					<p className="text-sm text-blue-800">
						<strong>Note:</strong> You can only see and manage
						sessions that you created.
						{remainingSessions !== null &&
							` You have ${remainingSessions} session${
								remainingSessions !== 1 ? "s" : ""
							} remaining.`}
					</p>
				</div>
			)}

			{(session?.user?.isSuperAdmin || remainingSessions > 0) && (
				<section className="bg-white rounded-2xl p-6 shadow-lg">
					<h2
						className="text-2xl font-bold mb-6"
						style={{ color: primaryDark }}
					>
						Start New Session
					</h2>

					<div className="space-y-5">
						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">
								What do you want to ask?
							</label>
							<input
								type="text"
								value={newPlace}
								onChange={(e) => setNewPlace(e.target.value)}
								className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
								placeholder="e.g. 'City Name' or 'Topic'"
							/>
						</div>

						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">
								Session Type
							</label>
							<div className="flex flex-col sm:flex-row gap-3">
								<button
									type="button"
									onClick={() => setSessionType("standard")}
									className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
										sessionType === "standard"
											? "border-blue-500 bg-blue-50"
											: "border-slate-300 hover:border-slate-400"
									}`}
								>
									<span className="block font-semibold text-slate-800">
										Standard (Democracy)
									</span>
									<span className="text-xs text-slate-500 mt-1 block">
										Two phases: idea collection with
										ratings, then debate & voting
									</span>
								</button>
								<button
									type="button"
									onClick={() => setSessionType("survey")}
									className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
										sessionType === "survey"
											? "border-purple-500 bg-purple-50"
											: "border-slate-300 hover:border-slate-400"
									}`}
								>
									<span className="block font-semibold text-slate-800">
										Survey (Rankings)
									</span>
									<span className="text-xs text-slate-500 mt-1 block">
										Time-limited responses with live
										rankings, then archived
									</span>
								</button>
							</div>
						</div>

						{sessionType === "survey" && (
							<div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-xl">
								<label className="block text-sm font-semibold text-purple-800 mb-2">
									Survey Duration (days)
								</label>
								<input
									type="number"
									min="1"
									max="365"
									value={surveyDurationDays}
									onChange={(e) =>
										setSurveyDurationDays(e.target.value)
									}
									className="w-full border-2 border-purple-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
								/>
								<p className="text-xs text-purple-600 mt-2">
									After this period, the session will be
									automatically archived and results will be
									preserved in the archive section.
								</p>
							</div>
						)}

						{sessionType === "standard" && (
							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={maxOneProposalPerUser}
										onChange={(e) =>
											setMaxOneProposalPerUser(
												e.target.checked
											)
										}
										className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
									/>
									<span className="text-sm font-semibold text-slate-700">
										Max one proposal each
									</span>
								</label>
								<p className="text-xs text-slate-500 mt-1 ml-6">
									Limit all users (except admins) to one
									proposal per session
								</p>
							</div>
						)}

						{sessionType === "survey" && (
							<div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={maxOneProposalPerUser}
										onChange={(e) =>
											setMaxOneProposalPerUser(
												e.target.checked
											)
										}
										className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-2 focus:ring-purple-500"
									/>
									<span className="text-sm font-semibold text-slate-700">
										Max one response each
									</span>
								</label>
								<p className="text-xs text-slate-500 mt-1 ml-6">
									Limit all users (except admins) to one
									response per survey
								</p>
							</div>
						)}

						<div>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={showUserCount}
									onChange={(e) =>
										setShowUserCount(e.target.checked)
									}
									className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
								/>
								<span className="text-sm font-semibold text-slate-700">
									Show user count
								</span>
							</label>
							<p className="text-xs text-slate-500 mt-1 ml-6">
								Display the number of active users in the header
							</p>
						</div>

						{sessionType === "standard" && (
							<>
								<div>
									<label className="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											checked={noMotivation}
											onChange={(e) =>
												setNoMotivation(
													e.target.checked
												)
											}
											className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
										/>
										<span className="text-sm font-semibold text-slate-700">
											No motivation
										</span>
									</label>
									<p className="text-xs text-slate-500 mt-1 ml-6">
										Hide problem and solution fields, only
										show proposal title
									</p>
								</div>

								<div>
									<label className="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											checked={singleResult}
											onChange={(e) =>
												setSingleResult(
													e.target.checked
												)
											}
											className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
										/>
										<span className="text-sm font-semibold text-slate-700">
											Single result
										</span>
									</label>
									<p className="text-xs text-slate-500 mt-1 ml-6">
										Only one winner: proposal with highest
										result (yes votes - no votes)
									</p>
								</div>

								<div>
									<label className="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											checked={onlyYesVotes}
											onChange={(e) =>
												setOnlyYesVotes(
													e.target.checked
												)
											}
											className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
										/>
										<span className="text-sm font-semibold text-slate-700">
											Only yes-votes
										</span>
									</label>
									<p className="text-xs text-slate-500 mt-1 ml-6">
										Replace the no-button with
										&quot;Next proposal&quot;. Users browse
										in a loop and confirm before voting.
									</p>
								</div>
							</>
						)}

						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">
								Language
							</label>
							<select
								value={language}
								onChange={(e) => setLanguage(e.target.value)}
								className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
							>
								<option value="sv">Svenska</option>
								<option value="en">English</option>
								<option value="sr">Српски (Serbian)</option>
								<option value="es">Español</option>
								<option value="de">Deutsch</option>
							</select>
							<p className="text-xs text-slate-500 mt-1">
								Select which language to use in the entire
								application
							</p>
						</div>

						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">
								Color Theme
							</label>
							<select
								value={themeValue}
								onChange={(e) => setThemeValue(e.target.value)}
								className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
							>
								<option value="default">
									Blue/Yellow - Sweden, English (Default)
								</option>
								<option value="green">
									Green - Germany, Activism
								</option>
								<option value="red">
									Red/Gold - Spain, Serbia
								</option>
							</select>
							<p className="text-xs text-slate-500 mt-1">
								Recommendations: Swedish/English→Blue,
								German→Green, Spanish/Serbian→Red
							</p>
						</div>

						{!session?.user?.isSuperAdmin &&
							remainingSessions !== null && (
								<p className="text-sm text-slate-600 font-medium">
									Remaining sessions:{" "}
									<strong
										className="text-lg"
										style={{ color: primaryDark }}
									>
										{remainingSessions}
									</strong>
								</p>
							)}

						<button
							onClick={createSession}
							disabled={creating}
							className="px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
							style={{
								backgroundColor: accentColor,
								color: primaryDark,
							}}
						>
							{creating ? "Starting..." : "Start session"}
						</button>

						{message && (
							<div
								className={`p-4 rounded-xl font-medium ${
									message.startsWith("Error")
										? "bg-red-100 text-red-700"
										: "bg-green-100 text-green-700"
								}`}
							>
								{message}
							</div>
						)}
					</div>
				</section>
			)}

			{!session?.user?.isSuperAdmin && remainingSessions === 0 && (
				<section className="p-6 bg-yellow-50 border-2 border-yellow-300 rounded-2xl shadow-lg">
					<h2
						className="text-2xl font-bold mb-4"
						style={{ color: primaryDark }}
					>
						Request More Sessions
					</h2>
					<p className="mb-5 text-slate-700">
						You have used all your allocated sessions. How many
						additional sessions would you like to request?
					</p>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">
								Number of Sessions (1-50)
							</label>
							<input
								type="number"
								min="1"
								max="50"
								value={requestedSessions}
								onChange={(e) =>
									setRequestedSessions(e.target.value)
								}
								className="w-full max-w-md border-2 border-slate-300 rounded-xl px-4 py-3"
							/>
						</div>
						<button
							onClick={requestMoreSessions}
							className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-bold shadow-md hover:shadow-lg transition-all"
						>
							Submit Request
						</button>
					</div>
				</section>
			)}

			{activeSessions.length > 0 && (
				<section className="bg-white rounded-2xl p-6 shadow-lg">
					<h2
						className="text-2xl font-bold mb-6"
						style={{ color: primaryDark }}
					>
						Active Sessions ({activeSessions.length})
					</h2>
					<div className="space-y-4">
						{activeSessions.map((activeSession) => (
							<div key={activeSession._id}>
								{activeSession.isOtherUserSession && (
									<div className="mb-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
										<p className="text-sm text-orange-800">
											<strong>Notice:</strong> This
											session was created by another
											admin.
										</p>
									</div>
								)}
								<div
									className={`p-5 border-2 rounded-xl space-y-4 ${
										activeSession.isOtherUserSession
											? "border-orange-300 bg-orange-50"
											: "border-green-300 bg-green-50"
									}`}
								>
									<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
										<div>
											<h3
												className="font-bold text-xl"
												style={{ color: primaryDark }}
											>
												{activeSession.place}
												{activeSession.isOtherUserSession && (
													<span className="ml-2 text-xs font-normal text-orange-600">
														(Created by another
														admin)
													</span>
												)}
											</h3>
											{activeSession.startDate && (
												<>
													<p className="text-sm text-slate-600 mt-1">
														Started:{" "}
														{new Date(
															activeSession.startDate
														).toLocaleString(
															"sv-SE",
															{
																year: "numeric",
																month: "short",
																day: "numeric",
																hour: "2-digit",
																minute: "2-digit",
															}
														)}
													</p>
													<p className="text-sm text-slate-500">
														Duration:{" "}
														{Math.floor(
															(new Date() -
																new Date(
																	activeSession.startDate
																)) /
																(1000 * 60 * 60)
														)}{" "}
														hours
													</p>
												</>
											)}
											<p
												className="text-sm font-bold mt-2"
												style={{ color: primaryDark }}
											>
												{activeSession.sessionType ===
												"survey" ? (
													<span className="text-purple-700">
														Ranking
													</span>
												) : (
													<>
														Current phase:{" "}
														{activeSession.phase ===
														"phase1"
															? "Phase 1 (Rating)"
															: "Phase 2 (Debate & Voting)"}
													</>
												)}
											</p>
											{session?.user?.isSuperAdmin &&
												activeSession.createdBy &&
												activeSession.createdBy !==
													"other" && (
													<p className="text-xs text-slate-500 mt-1">
														Created by:{" "}
														{typeof activeSession.createdBy ===
														"object"
															? activeSession
																	.createdBy
																	.name
															: activeSession.createdBy}
													</p>
												)}
										</div>
										{!activeSession.isOtherUserSession &&
											(session?.user?.isSuperAdmin ||
												(typeof activeSession.createdBy ===
												"object"
													? activeSession.createdBy
															._id
													: activeSession.createdBy
												)?.toString() ===
													session?.user?.id) &&
											(activeSession.sessionType ===
											"survey" ? (
												<button
													onClick={() =>
														archiveSession(
															activeSession._id
														)
													}
													className="px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold shadow-md hover:shadow-lg transition-all"
												>
													Archive ranking
												</button>
											) : (
												<button
													onClick={() =>
														closeSession(
															activeSession._id
														)
													}
													className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold shadow-md hover:shadow-lg transition-all"
												>
													Close session
												</button>
											))}
									</div>

									{!activeSession.isOtherUserSession &&
										activeSession.sessionType !== "survey" &&
										(activeSession.phase === "phase1" || activeSession.phase === "phase2") && (
											<LivePanel
												sessionId={activeSession._id}
												onPhaseAdvanced={loadSessions}
											/>
										)}

									{!activeSession.isOtherUserSession &&
										session?.user?.isSuperAdmin &&
										activeSession.activeUsersWithStatus &&
										activeSession.activeUsersWithStatus
											.length > 0 && (
											<div className="mt-4 pt-4 border-t-2 border-green-200">
												<h4 className="font-bold text-sm text-slate-700 mb-3">
													Active Users (
													{
														activeSession
															.activeUsersWithStatus
															.length
													}
													)
												</h4>
												<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
													{activeSession.activeUsersWithStatus.map(
														(user) => (
															<div
																key={user._id}
																className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm"
															>
																<div className="flex-1 min-w-0">
																	<p className="text-sm font-semibold text-slate-900 truncate">
																		{
																			user.name
																		}
																	</p>
																	<p className="text-xs text-slate-500 truncate">
																		{
																			user.email
																		}
																	</p>
																</div>
																{activeSession.phase ===
																	"phase2" && (
																	<div className="ml-2 flex-shrink-0">
																		{user.hasVoted ? (
																			<span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-800">
																				✓
																				Voted
																			</span>
																		) : (
																			<span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-800">
																				Pending
																			</span>
																		)}
																	</div>
																)}
															</div>
														)
													)}
												</div>
											</div>
										)}
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			<section className="bg-white rounded-2xl p-6 shadow-lg">
				<div className="flex items-center justify-between mb-6">
					<h2
						className="text-2xl font-bold"
						style={{ color: primaryDark }}
					>
						Closed Sessions
					</h2>
					{!session?.user?.isSuperAdmin &&
						closedSessions.length > 0 && (
							<p className="text-xs text-slate-500">
								Your sessions only
							</p>
						)}
				</div>
				{closedSessions.length > 0 ? (
					<div className="space-y-3">
						{closedSessions.map((sessionItem) => {
							const startDate = new Date(sessionItem.startDate);
							const endDate = new Date(sessionItem.endDate);
							const durationHours = Math.floor(
								(endDate - startDate) / (1000 * 60 * 60)
							);
							const durationDays = Math.floor(durationHours / 24);
							const remainingHours = durationHours % 24;

							return (
								<div
									key={sessionItem._id}
									className="p-4 border-2 border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
								>
									<h3
										className="font-bold text-lg"
										style={{ color: primaryDark }}
									>
										{sessionItem.place}
									</h3>
									<p className="text-sm text-slate-600 mt-1">
										Started:{" "}
										{startDate.toLocaleString("sv-SE", {
											year: "numeric",
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
									<p className="text-sm text-slate-600">
										Ended:{" "}
										{endDate.toLocaleString("sv-SE", {
											year: "numeric",
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
									<p className="text-sm text-slate-500 font-medium">
										Duration:{" "}
										{durationDays > 0
											? `${durationDays}d ${remainingHours}h`
											: `${remainingHours}h`}
									</p>
								</div>
							);
						})}
					</div>
				) : (
					<p className="text-slate-500 text-center py-8">
						No closed sessions
					</p>
				)}
			</section>
		</div>
	);
}

function LivePanel({ sessionId, onPhaseAdvanced }) {
	const { theme } = useConfig();
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [adjusting, setAdjusting] = useState(false);
	const [advancing, setAdvancing] = useState(false);
	const [countdown, setCountdown] = useState(null);
	const timerRef = useRef(null);
	const pollRef = useRef(null);
	const lastAdjustRef = useRef(0);

	const primaryDark = theme?.primaryDark || "#001440";

	const executeTermination = useCallback(async () => {
		try {
			await fetch("/api/admin/execute-scheduled-termination", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId }),
			});
		} catch (error) {
			console.error("Failed to execute termination:", error);
		}
	}, [sessionId]);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch(`/api/admin/live-panel?sessionId=${sessionId}`);
			if (res.ok) {
				const result = await res.json();
				// Preserve local customTopCount if recently adjusted (avoid poll race condition)
				if (result.phase === "phase1" && Date.now() - lastAdjustRef.current < 8000) {
					setData((prev) => prev ? { ...result, customTopCount: prev.customTopCount } : result);
				} else {
					setData(result);
				}
				// Phase 1: transition countdown
				if (result.phase === "phase1") {
					if (result.transitionScheduled && result.secondsRemaining > 0) {
						setCountdown(result.secondsRemaining);
					} else if (!result.transitionScheduled) {
						setCountdown(null);
					}
				}
				// Phase 2: termination countdown
				if (result.phase === "phase2") {
					if (result.terminationScheduled && result.secondsRemaining > 0) {
						setCountdown(result.secondsRemaining);
					} else if (!result.terminationScheduled) {
						setCountdown(null);
					}
				}
			}
		} catch (error) {
			console.error("LivePanel fetch error:", error);
		}
		setLoading(false);
	}, [sessionId]);

	// Poll every 5 seconds
	useEffect(() => {
		fetchData(); // eslint-disable-line react-hooks/set-state-in-effect
		pollRef.current = setInterval(fetchData, 5000);
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [fetchData]);

	// Countdown timer (ticks every second when transition/termination is scheduled)
	useEffect(() => {
		if (countdown !== null && countdown > 0) {
			timerRef.current = setInterval(() => {
				setCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(timerRef.current);
						// Phase 2: execute termination when timer expires
						if (data?.phase === "phase2") {
							executeTermination().then(() => {
								fetchData();
								if (onPhaseAdvanced) onPhaseAdvanced();
							});
						} else {
							fetchData();
							if (onPhaseAdvanced) onPhaseAdvanced();
						}
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [countdown, fetchData, onPhaseAdvanced, data?.phase, executeTermination]);

	// Listen for Pusher events to trigger immediate refresh
	useSSE({
		onRatingUpdate: () => fetchData(),
		onNewProposal: () => fetchData(),
		onVoteUpdate: () => fetchData(),
		onTransitionScheduled: () => fetchData(),
		onTerminationScheduled: () => fetchData(),
		onPhaseChange: () => {
			fetchData();
			if (onPhaseAdvanced) onPhaseAdvanced();
		},
	});

	const adjustTopCount = async (delta) => {
		if (!data || adjusting) return;
		const current = data.customTopCount || data.calculatedTopCount;
		const newCount = current + delta;
		if (newCount < 2 || newCount > data.totalProposals) return;

		setAdjusting(true);
		try {
			const res = await fetchWithCsrf("/api/admin/live-panel", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId, customTopCount: newCount }),
			});

			if (res.ok) {
				lastAdjustRef.current = Date.now();
				setData((prev) => ({ ...prev, customTopCount: newCount }));
			}
		} catch (error) {
			console.error("Failed to adjust top count:", error);
		}
		setAdjusting(false);
	};

	const activateTransition = async () => {
		if (advancing) return;
		if (!confirm("Start 90-second countdown to Phase 2? You can adjust the number of proposals during the countdown.")) return;

		setAdvancing(true);
		try {
			const res = await fetchWithCsrf("/api/admin/schedule-transition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId }),
			});

			if (res.ok) {
				fetchData();
			} else {
				const errData = await res.json();
				alert(`Error: ${errData.error}`);
			}
		} catch (error) {
			console.error("Failed to schedule transition:", error);
			alert("Could not schedule phase transition");
		}
		setAdvancing(false);
	};

	const activateTermination = async () => {
		if (advancing) return;
		if (!confirm("Start 60-second termination timer? The session will close when it expires.")) return;

		setAdvancing(true);
		try {
			const res = await fetchWithCsrf("/api/admin/schedule-termination", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId }),
			});

			if (res.ok) {
				fetchData();
			} else {
				const errData = await res.json();
				alert(`Error: ${errData.error}`);
			}
		} catch (error) {
			console.error("Failed to schedule termination:", error);
			alert("Could not schedule termination");
		}
		setAdvancing(false);
	};

	if (loading) {
		return (
			<div className="mt-4 pt-4 border-t-2 border-green-200">
				<p className="text-sm text-slate-500">Loading Live Panel...</p>
			</div>
		);
	}

	if (!data) return null;

	// Phase 2 UI
	if (data.phase === "phase2") {
		const votedPercent = data.activeUsersCount > 0
			? Math.round((data.usersWhoVotedCount / data.activeUsersCount) * 100)
			: 0;
		const isTerminating = data.terminationScheduled && countdown !== null;

		return (
			<div className="mt-4 pt-4 border-t-2 border-orange-200">
				<div className="flex items-center gap-2 mb-4">
					<Radio className="w-4 h-4 text-orange-600" />
					<h4 className="font-bold text-sm" style={{ color: primaryDark }}>
						Live Panel — Phase 2
					</h4>
				</div>

				<div className="space-y-3">
					{/* Users voted ratio */}
					<div>
						<div className="flex items-center justify-between text-sm mb-1">
							<span className="text-slate-600 font-medium">Users voted</span>
							<span className="font-bold" style={{ color: primaryDark }}>
								{data.usersWhoVotedCount} / {data.activeUsersCount}
								<span className="text-slate-400 font-normal ml-1">({votedPercent}%)</span>
							</span>
						</div>
						<div className="w-full bg-slate-200 rounded-full h-2.5">
							<div
								className="h-2.5 rounded-full transition-all duration-500"
								style={{
									width: `${Math.min(100, votedPercent)}%`,
									backgroundColor: votedPercent >= 75 ? "#16a34a" : primaryDark,
								}}
							/>
						</div>
					</div>

					{/* Signal lamp and termination controls */}
					<div className="flex items-center justify-between pt-2">
						<div className="flex items-center gap-2">
							<div
								className={`w-4 h-4 rounded-full border-2 ${
									isTerminating
										? "bg-orange-500 border-orange-600 animate-pulse"
										: data.terminationConditionMet
										? "bg-green-500 border-green-600"
										: "bg-slate-300 border-slate-400"
								}`}
							/>
							<span className="text-sm font-medium text-slate-700">
								{isTerminating
									? "Termination active"
									: data.terminationConditionMet
									? "Ready to terminate"
									: "Termination phase"}
							</span>
						</div>

						{!isTerminating && (
							<button
								onClick={activateTermination}
								disabled={advancing}
								className="px-4 py-1.5 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
								style={{
									backgroundColor: primaryDark,
									color: "white",
								}}
							>
								{advancing ? "Activating..." : "Activate termination"}
							</button>
						)}
					</div>

					{/* Termination countdown */}
					{isTerminating && (
						<div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-orange-800">
									Session closes in
								</span>
								<span className="text-2xl font-bold text-orange-700">
									{countdown}s
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}

	// Phase 1 UI
	const usersPercent = data.activeUsersCount > 0
		? Math.round((data.usersWhoRatedCount / data.activeUsersCount) * 100)
		: 0;
	const proposalsPercent = data.totalProposals > 0
		? Math.round((data.ratedProposals / data.totalProposals) * 100)
		: 0;
	const effectiveTopCount = data.customTopCount || data.calculatedTopCount;
	const isTransitioning = data.transitionScheduled && countdown !== null;

	return (
		<div className="mt-4 pt-4 border-t-2 border-green-200">
			<div className="flex items-center gap-2 mb-4">
				<Radio className="w-4 h-4 text-green-600" />
				<h4 className="font-bold text-sm" style={{ color: primaryDark }}>
					Live Panel
				</h4>
			</div>

			<div className="space-y-3">
				{/* Users ratio */}
				<div>
					<div className="flex items-center justify-between text-sm mb-1">
						<span className="text-slate-600 font-medium">Users rated</span>
						<span className="font-bold" style={{ color: primaryDark }}>
							{data.usersWhoRatedCount} / {data.activeUsersCount}
							<span className="text-slate-400 font-normal ml-1">({usersPercent}%)</span>
						</span>
					</div>
					<div className="w-full bg-slate-200 rounded-full h-2.5">
						<div
							className="h-2.5 rounded-full transition-all duration-500"
							style={{
								width: `${Math.min(100, usersPercent)}%`,
								backgroundColor: usersPercent >= 75 ? "#16a34a" : primaryDark,
							}}
						/>
					</div>
				</div>

				{/* Proposals ratio */}
				<div>
					<div className="flex items-center justify-between text-sm mb-1">
						<span className="text-slate-600 font-medium">Proposals rated</span>
						<span className="font-bold" style={{ color: primaryDark }}>
							{data.ratedProposals} / {data.totalProposals}
							<span className="text-slate-400 font-normal ml-1">({proposalsPercent}%)</span>
						</span>
					</div>
					<div className="w-full bg-slate-200 rounded-full h-2.5">
						<div
							className="h-2.5 rounded-full transition-all duration-500"
							style={{
								width: `${Math.min(100, proposalsPercent)}%`,
								backgroundColor: proposalsPercent >= 75 ? "#16a34a" : primaryDark,
							}}
						/>
					</div>
				</div>

				{/* Signal lamp and transition controls */}
				<div className="flex items-center justify-between pt-2">
					<div className="flex items-center gap-2">
						<div
							className={`w-4 h-4 rounded-full border-2 ${
								isTransitioning
									? "bg-green-500 border-green-600 animate-pulse"
									: data.conditionsMet
									? "bg-green-500 border-green-600"
									: "bg-slate-300 border-slate-400"
							}`}
						/>
						<span className="text-sm font-medium text-slate-700">
							{isTransitioning
								? "Phase transition"
								: data.conditionsMet
								? "Conditions met"
								: "Phase transition"}
						</span>
					</div>

					{!isTransitioning && (
						<button
							onClick={activateTransition}
							disabled={advancing || data.totalProposals < 2}
							className="px-4 py-1.5 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							style={{
								backgroundColor: primaryDark,
								color: "white",
							}}
						>
							{advancing ? "Activating..." : "Activate"}
						</button>
					)}
				</div>

				{/* Transition countdown and proposal adjuster */}
				{isTransitioning && (
					<div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-green-800">
								Transition in
							</span>
							<span className="text-2xl font-bold text-green-700">
								{countdown}s
							</span>
						</div>

						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-green-800">
								Proposals to proceed
							</span>
							<div className="flex items-center gap-2">
								<button
									onClick={() => adjustTopCount(-1)}
									disabled={adjusting || effectiveTopCount <= 2}
									className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border-2 border-green-300 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
								>
									<Minus className="w-4 h-4" />
								</button>
								<span className="w-10 text-center text-lg font-bold text-green-800">
									{effectiveTopCount}
								</span>
								<button
									onClick={() => adjustTopCount(1)}
									disabled={adjusting || effectiveTopCount >= data.totalProposals}
									className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border-2 border-green-300 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
								>
									<Plus className="w-4 h-4" />
								</button>
							</div>
						</div>

						{data.customTopCount && data.customTopCount !== data.calculatedTopCount && (
							<p className="text-xs text-green-600">
								Default: {data.calculatedTopCount} (adjusted to {data.customTopCount})
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
