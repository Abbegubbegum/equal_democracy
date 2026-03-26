import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Star, Plus, TrendingUp, Clock, Award, Users, Calendar, ChevronRight } from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";
import useSSE from "../lib/hooks/useSSE";

const CATEGORY_NAMES = {
	1: "Bygga, bo och miljö",
	2: "Fritid och kultur",
	3: "Förskola och skola",
	4: "Ändring av styrdokument",
	5: "Näringsliv och arbete",
	6: "Omsorg och hjälp",
	7: "Övrigt kommun och politik",
};

export default function MedborgarforslagPage() {
	const { data: session } = useSession();
	const router = useRouter();
	const { t } = useTranslation();
	const { theme } = useConfig();
	const [proposals, setProposals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState("list"); // 'list' or 'create'
	const [sortBy, setSortBy] = useState("popular"); // 'popular' or 'recent'
	const [filterCategory, setFilterCategory] = useState(null);
	const [activeSessions, setActiveSessions] = useState([]);

	// Create form
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [selectedCategories, setSelectedCategories] = useState([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const fetchActiveSessions = useCallback(async () => {
		try {
			const res = await fetch("/api/sessions/active");
			const data = await res.json();
			const sessions = Array.isArray(data) ? data : [];
			setActiveSessions(sessions.filter((s) => s.sessionType !== "municipal"));
		} catch (err) {
			console.error("Error fetching sessions:", err);
		}
	}, []);

	useSSE({
		onNewSession: fetchActiveSessions,
		onPhaseChange: fetchActiveSessions,
		onSessionArchived: fetchActiveSessions,
		onConnected: () => {},
		onError: () => {},
	});

	useEffect(() => {
		if (session) {
			fetchActiveSessions();
		}
	}, [session, fetchActiveSessions]);

	useEffect(() => {
		fetchProposals();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sortBy, filterCategory]);

	const fetchProposals = async () => {
		try {
			const params = new URLSearchParams();
			if (sortBy === "recent") params.append("sort", "recent");
			if (filterCategory) params.append("category", filterCategory);

			const res = await fetch(`/api/citizen-proposals?${params.toString()}`);
			const data = await res.json();
			setProposals(data.proposals || []);
		} catch (err) {
			console.error("Error fetching proposals:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleRate = async (proposalId, rating) => {
		if (!session) {
			router.push("/login");
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/citizen-proposals/rate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ proposalId, rating }),
			});

			if (res.ok) {
				const data = await res.json();
				// Update proposal in list
				setProposals((prev) =>
					prev.map((p) =>
						p._id === proposalId
							? {
									...p,
									totalStars: data.totalStars,
									ratingCount: data.ratingCount,
									averageRating: data.averageRating,
									userRating: data.userRating,
								}
							: p
					)
				);
			}
		} catch (err) {
			console.error("Error rating proposal:", err);
		}
	};

	const handleCreate = async (e) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");

		if (!session) {
			router.push("/login");
			return;
		}

		try {
			const res = await fetchWithCsrf("/api/citizen-proposals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					description,
					categories: selectedCategories,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				setTitle("");
				setDescription("");
				setSelectedCategories([]);
				setView("list");
				await fetchProposals();
			} else {
				setError(data.message || "Failed to create proposal");
			}
		} catch (err) {
			console.error("Error creating proposal:", err);
			setError("Ett fel uppstod");
		} finally {
			setSubmitting(false);
		}
	};

	const toggleCategory = (cat) => {
		if (selectedCategories.includes(cat)) {
			setSelectedCategories(selectedCategories.filter((c) => c !== cat));
		} else {
			if (selectedCategories.length < 3) {
				setSelectedCategories([...selectedCategories, cat]);
			}
		}
	};

	const primaryColor = theme?.colors?.primary[600] || "#002d75";
	const accentColor = theme?.colors?.accent[400] || "#f8b60e";
	const primaryDark = theme?.colors?.primary[800] || "#001c55";

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-primary-600 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold mb-2">Idéer</h1>
							<p className="text-primary-100">
								Föreslå idéer och delta i omröstningar
							</p>
						</div>
						<Link
							href="/"
							className="px-4 py-2 bg-yellow-400 text-gray-900 hover:bg-yellow-500 rounded-lg font-medium"
						>
							{t("common.backToStart")}
						</Link>
					</div>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6">

				{/* Active sessions */}
				{activeSessions.length > 0 && (
					<section className="mb-8">
						<h2 className="text-lg font-semibold text-gray-700 mb-3">
							Aktiva omröstningar
						</h2>
						<div className="grid gap-4">
							{activeSessions.map((s) => (
								<SessionCard
									key={s._id}
									session={s}
									onClick={() => router.push(`/session/${s._id}`)}
									t={t}
									primaryDark={primaryDark}
									accentColor={accentColor}
								/>
							))}
						</div>
					</section>
				)}

				{/* Navigation */}
				<div className="mb-6 flex flex-wrap gap-3 items-center justify-between">
					<div className="flex gap-2">
						<button
							onClick={() => setView("list")}
							className={`px-4 py-2 rounded-lg font-medium transition-colors ${
								view === "list"
									? "bg-white text-primary-600 shadow"
									: "text-gray-600 hover:bg-white/50"
							}`}
						>
							Alla Förslag
						</button>
						<button
							onClick={() => {
								if (!session) {
									router.push("/login");
								} else {
									setView("create");
								}
							}}
							className={`px-4 py-2 rounded-lg font-medium transition-colors ${
								view === "create"
									? "bg-white text-primary-600 shadow"
									: "text-gray-600 hover:bg-white/50"
							}`}
						>
							<Plus className="w-4 h-4 inline mr-1" />
							Skapa Förslag
						</button>
					</div>

					{view === "list" && (
						<div className="flex gap-2">
							<select
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
								className="px-3 py-2 bg-white rounded-lg border text-sm"
							>
								<option value="popular">
									<TrendingUp className="w-4 h-4 inline mr-1" />
									Mest Populära
								</option>
								<option value="recent">
									<Clock className="w-4 h-4 inline mr-1" />
									Senaste
								</option>
							</select>

							<select
								value={filterCategory || ""}
								onChange={(e) =>
									setFilterCategory(
										e.target.value ? parseInt(e.target.value) : null
									)
								}
								className="px-3 py-2 bg-white rounded-lg border text-sm"
							>
								<option value="">Alla Kategorier</option>
								{Object.entries(CATEGORY_NAMES).map(([num, name]) => (
									<option key={num} value={num}>
										{name}
									</option>
								))}
							</select>
						</div>
					)}
				</div>

				{/* List View */}
				{view === "list" && (
					<div className="space-y-4">
						{loading ? (
							<div className="text-center py-12 text-gray-500">
								Laddar...
							</div>
						) : proposals.length === 0 ? (
							<div className="bg-white rounded-lg shadow p-12 text-center">
								<p className="text-gray-500 mb-4">
									Inga förslag än. Var först att föreslå en idé!
								</p>
								<button
									onClick={() => {
										if (!session) {
											router.push("/login");
										} else {
											setView("create");
										}
									}}
									className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
								>
									<Plus className="w-4 h-4 inline mr-2" />
									Skapa Förslag
								</button>
							</div>
						) : (
							proposals.map((proposal) => (
								<ProposalCard
									key={proposal._id}
									proposal={proposal}
									onRate={handleRate}
									session={session}
								/>
							))
						)}
					</div>
				)}

				{/* Create View */}
				{view === "create" && (
					<div className="bg-white rounded-lg shadow p-6">
						<h2 className="text-2xl font-bold mb-4">
							Skapa Idé
						</h2>

						{error && (
							<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
								{error}
							</div>
						)}

						<form onSubmit={handleCreate} className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-2">
									Titel *
								</label>
								<input
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="T.ex. 'Bygg fler cykelbanor i centrum'"
									className="w-full px-4 py-2 border rounded-lg"
									maxLength={200}
									required
								/>
								<p className="text-xs text-gray-500 mt-1">
									{title.length}/200 tecken
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Beskrivning *
								</label>
								<textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Beskriv ditt förslag i detalj..."
									rows={6}
									className="w-full px-4 py-2 border rounded-lg"
									maxLength={2000}
									required
								/>
								<p className="text-xs text-gray-500 mt-1">
									{description.length}/2000 tecken
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Kategorier * (välj 1-3)
								</label>
								<div className="flex flex-wrap gap-2">
									{Object.entries(CATEGORY_NAMES).map(([num, name]) => {
										const cat = parseInt(num);
										const isSelected =
											selectedCategories.includes(cat);
										return (
											<button
												key={num}
												type="button"
												onClick={() => toggleCategory(cat)}
												className={`px-3 py-2 rounded-lg text-sm transition-colors ${
													isSelected
														? "bg-primary-600 text-white"
														: "bg-gray-100 text-gray-700 hover:bg-gray-200"
												}`}
											>
												{name}
											</button>
										);
									})}
								</div>
								<p className="text-xs text-gray-500 mt-1">
									{selectedCategories.length}/3 valda
								</p>
							</div>

							<div className="flex gap-3 pt-4">
								<button
									type="button"
									onClick={() => setView("list")}
									className="px-6 py-3 border rounded-lg hover:bg-gray-50"
								>
									Avbryt
								</button>
								<button
									type="submit"
									disabled={
										submitting || selectedCategories.length === 0
									}
									className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
								>
									{submitting ? "Skapar..." : "Skapa Idé"}
								</button>
							</div>
						</form>
					</div>
				)}
			</main>
		</div>
	);
}

function ProposalCard({ proposal, onRate, session }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
			<div className="p-6">
				{/* Header */}
				<div className="flex items-start justify-between mb-3">
					<div className="flex-1">
						<h3 className="text-xl font-bold text-gray-900 mb-2">
							{proposal.title}
						</h3>
						<div className="flex flex-wrap gap-2 mb-2">
							{proposal.categories.map((cat) => (
								<span
									key={cat}
									className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
								>
									{CATEGORY_NAMES[cat]}
								</span>
							))}
							{proposal.isOwn && (
								<span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
									Ditt förslag
								</span>
							)}
						</div>
					</div>

					{/* Total Stars */}
					<div className="flex flex-col items-center ml-4">
						<div className="flex items-center gap-1 text-yellow-500">
							<Award className="w-6 h-6" />
							<span className="text-2xl font-bold">
								{proposal.totalStars}
							</span>
						</div>
						<p className="text-xs text-gray-500">
							{proposal.ratingCount} röster
						</p>
					</div>
				</div>

				{/* Description */}
				<p
					className={`text-gray-700 mb-4 ${!expanded && "line-clamp-3"}`}
				>
					{proposal.description}
				</p>

				{proposal.description.length > 150 && (
					<button
						onClick={() => setExpanded(!expanded)}
						className="text-primary-600 text-sm font-medium hover:underline mb-4"
					>
						{expanded ? "Visa mindre" : "Läs mer"}
					</button>
				)}

				{/* Rating */}
				<div className="border-t pt-4">
					<p className="text-sm text-gray-600 mb-2">
						{proposal.userRating
							? "Din röst: "
							: "Ge ditt stöd (1-5 stjärnor):"}
					</p>
					<div className="flex gap-1">
						{[1, 2, 3, 4, 5].map((star) => (
							<button
								key={star}
								onClick={() => onRate(proposal._id, star)}
								disabled={!session}
								className="transition-transform hover:scale-125 disabled:opacity-50"
								title={
									!session
										? "Logga in för att rösta"
										: `Ge ${star} stjärnor`
								}
							>
								<Star
									className={`w-8 h-8 ${
										star <= (proposal.userRating || 0)
											? "fill-yellow-400 text-yellow-400"
											: "text-gray-300"
									}`}
								/>
							</button>
						))}
					</div>
					{!session && (
						<p className="text-xs text-gray-500 mt-2">
							Logga in för att rösta på förslag
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function SessionCard({ session, onClick, t, primaryDark, accentColor }) {
	const isSurvey = session.sessionType === "survey";

	const phaseLabel = isSurvey
		? t("ranking.liveRankings") || "Live Rankings"
		: session.phase === "phase1"
			? t("phases.phase1") || "Phase 1 - Idea Collection"
			: session.phase === "phase2"
				? t("phases.phase2") || "Phase 2 - Voting"
				: t("phases.closed") || "Closed";

	const phaseColor = isSurvey
		? "bg-purple-100 text-purple-800"
		: session.phase === "phase1"
			? "bg-blue-100 text-blue-800"
			: session.phase === "phase2"
				? "bg-green-100 text-green-800"
				: "bg-gray-100 text-gray-800";

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("sv-SE", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<button
			onClick={onClick}
			className="w-full bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 p-6 text-left group hover:scale-[1.02]"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					<h3 className="text-xl font-bold text-gray-900 mb-2 wrap-break-word group-hover:text-primary-700">
						{session.place || "Unnamed Session"}
					</h3>

					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span
							className={`px-3 py-1 rounded-full text-sm font-medium ${phaseColor}`}
						>
							{phaseLabel}
						</span>
						{session.activeUsersCount > 0 && (
							<span className="flex items-center gap-1 text-sm text-gray-500">
								<Users className="w-4 h-4" />
								{session.activeUsersCount}{" "}
								{t("sessions.activeUsers") || "active"}
							</span>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
						{session.startDate && (
							<span className="flex items-center gap-1">
								<Calendar className="w-4 h-4" />
								{formatDate(session.startDate)}
							</span>
						)}
						{isSurvey && session.archiveDate && (
							<span className="flex items-center gap-1 text-purple-600">
								<Clock className="w-4 h-4" />
								{(() => {
									const now = new Date();
									const archive = new Date(session.archiveDate);
									const diff = archive - now;
									if (diff <= 0)
										return t("ranking.rankingEnded") || "Ended";
									const days = Math.floor(diff / (1000 * 60 * 60 * 24));
									const hours = Math.floor(
										(diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
									);
									return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
								})()}{" "}
								{t("ranking.timeRemaining") || "remaining"}
							</span>
						)}
					</div>
				</div>

				<div
					className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
					style={{ backgroundColor: accentColor }}
				>
					<ChevronRight
						className="w-6 h-6"
						style={{ color: primaryDark }}
					/>
				</div>
			</div>
		</button>
	);
}
