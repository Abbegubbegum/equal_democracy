import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Archive, Users, Calendar, Award, Lightbulb, Wallet, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "../../lib/hooks/useTranslation";

export default function ArchivePage() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const { t } = useTranslation();
	const [archivedSessions, setArchivedSessions] = useState([]);
	const [municipalSessions, setMunicipalSessions] = useState([]);
	const [citizenProposals, setCitizenProposals] = useState([]);
	const [budgetSessions, setBudgetSessions] = useState([]);
	const [loading, setLoading] = useState(true);

	// Collapsible section state
	const [expandedSections, setExpandedSections] = useState({
		budget: false,
		municipal: false,
		proposals: false,
		sessions: false,
	});

	const toggleSection = (section) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	useEffect(() => {
		if (status === "loading") return;
		if (!session) {
			router.replace("/login");
			return;
		}
		fetchAllArchives();
	}, [status, session, router]);

	const fetchAllArchives = async () => {
		try {
			// Fetch archived regular sessions
			const sessionsRes = await fetch("/api/sessions/archived");
			const sessionsData = await sessionsRes.json();
			setArchivedSessions(Array.isArray(sessionsData) ? sessionsData : []);

			// Fetch all non-draft municipal sessions
			const municipalRes = await fetch("/api/municipal/sessions");
			const municipalData = await municipalRes.json();
			setMunicipalSessions((municipalData.sessions || []).filter(s => s.status !== "draft"));

			// Fetch all citizen proposals
			const proposalsRes = await fetch("/api/citizen-proposals?status=all");
			const proposalsData = await proposalsRes.json();
			setCitizenProposals(proposalsData.proposals || []);

			// Fetch all non-draft budget sessions
			const budgetRes = await fetch("/api/budget/sessions");
			const budgetData = await budgetRes.json();
			setBudgetSessions((budgetData.sessions || []).filter(s => s.status !== "draft"));
		} catch (error) {
			console.error("Error fetching archives:", error);
		} finally {
			setLoading(false);
		}
	};

	if (status === "loading" || loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-xl text-gray-600">Laddar...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-slate-700 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Archive className="w-8 h-8" />
							<div>
								<h1 className="text-3xl font-bold">Arkivet</h1>
								<p className="text-slate-300">
									Alla avslutade frågor och beslut
								</p>
							</div>
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

			<main className="max-w-6xl mx-auto p-6 space-y-4">
				{/* Budget Archive */}
				<section>
					<button
						onClick={() => toggleSection("budget")}
						className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition-colors"
					>
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
								<Wallet className="w-6 h-6 text-green-600" />
							</div>
							<div className="text-left">
								<h2 className="text-xl font-bold text-gray-800">
									Budget
								</h2>
								<p className="text-sm text-gray-600">
									{budgetSessions.length} sessioner
								</p>
							</div>
						</div>
						<ChevronRight
							className={`w-6 h-6 text-gray-500 transition-transform ${
								expandedSections.budget ? "rotate-90" : ""
							}`}
						/>
					</button>

					{expandedSections.budget && (
						<div className="mt-3 ml-4">
							{budgetSessions.length === 0 ? (
								<div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
									Inga arkiverade budgetsessioner än
								</div>
							) : (
								<div className="grid gap-4">
									{budgetSessions.map((budgetSession) => (
										<Link
											key={budgetSession._id}
											href={`/budget/${budgetSession.sessionId}`}
											className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
										>
											<h3 className="font-semibold text-lg mb-1">
												{budgetSession.name}
											</h3>
											<p className="text-sm text-gray-600">
												{budgetSession.municipality}
											</p>
											<div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
												<Calendar className="w-4 h-4" />
												{budgetSession.endDate
													? new Date(
															budgetSession.endDate
													  ).toLocaleDateString("sv-SE")
													: "Avslutad"}
											</div>
										</Link>
									))}
								</div>
							)}
						</div>
					)}
				</section>

				{/* Kommunfullmäktige Archive */}
				<section>
					<button
						onClick={() => toggleSection("municipal")}
						className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition-colors"
					>
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
								<Users className="w-6 h-6 text-blue-600" />
							</div>
							<div className="text-left">
								<h2 className="text-xl font-bold text-gray-800">
									Kommunen
								</h2>
								<p className="text-sm text-gray-600">
									{municipalSessions.length} möten
								</p>
							</div>
						</div>
						<ChevronRight
							className={`w-6 h-6 text-gray-500 transition-transform ${
								expandedSections.municipal ? "rotate-90" : ""
							}`}
						/>
					</button>

					{expandedSections.municipal && (
						<div className="mt-3 ml-4">
							{municipalSessions.length === 0 ? (
								<div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
									Inga arkiverade kommunala beslut än
								</div>
							) : (
								<div className="grid gap-4">
									{municipalSessions.map((municipalSession) => (
										<div
											key={municipalSession._id}
											className="bg-white rounded-lg shadow p-4"
										>
											<div className="flex items-start justify-between mb-2">
												<div>
													<h3 className="font-semibold text-lg">
														{municipalSession.name}
													</h3>
													<p className="text-sm text-gray-600">
														{municipalSession.meetingType} •{" "}
														{municipalSession.municipality}
													</p>
												</div>
												<span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">
													Avslutad
												</span>
											</div>
											<div className="text-xs text-gray-500">
												<Calendar className="w-4 h-4 inline mr-1" />
												{new Date(
													municipalSession.meetingDate
												).toLocaleDateString("sv-SE")}
											</div>
											<div className="mt-2 text-sm text-gray-600">
												{municipalSession.items.filter(
													(item) => item.status === "closed"
												).length}{" "}
												avslutade ärenden
											</div>
											<Link
												href={`/${municipalSession.municipality.toLowerCase()}/${municipalSession.meetingType
													.toLowerCase()
													.replace(/ /g, "-")}/archive`}
												className="mt-2 inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
											>
												Visa beslut
											</Link>
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</section>

				{/* Medborgarförslag Archive */}
				<section>
					<button
						onClick={() => toggleSection("proposals")}
						className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition-colors"
					>
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
								<Lightbulb className="w-6 h-6 text-purple-600" />
							</div>
							<div className="text-left">
								<h2 className="text-xl font-bold text-gray-800">
									Idéer
								</h2>
								<p className="text-sm text-gray-600">
									{citizenProposals.length} idéer
								</p>
							</div>
						</div>
						<ChevronRight
							className={`w-6 h-6 text-gray-500 transition-transform ${
								expandedSections.proposals ? "rotate-90" : ""
							}`}
						/>
					</button>

					{expandedSections.proposals && (
						<div className="mt-3 ml-4">
							{citizenProposals.length === 0 ? (
								<div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
									Inga arkiverade idéer än
								</div>
							) : (
								<div className="grid gap-4">
									{citizenProposals.map((proposal) => (
										<div
											key={proposal._id}
											className="bg-white rounded-lg shadow p-4"
										>
											<h3 className="font-semibold text-lg mb-2">
												{proposal.title}
											</h3>
											<p className="text-gray-700 text-sm mb-2 line-clamp-2">
												{proposal.description}
											</p>
											<div className="flex items-center gap-2 text-sm text-gray-600">
												<Award className="w-4 h-4 text-yellow-500" />
												{proposal.totalStars} stjärnor
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</section>

				{/* Enkla Frågor (Regular Sessions) Archive */}
				<section>
					<button
						onClick={() => toggleSection("sessions")}
						className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 rounded-lg shadow transition-colors"
					>
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
								<Archive className="w-6 h-6 text-yellow-600" />
							</div>
							<div className="text-left">
								<h2 className="text-xl font-bold text-gray-800">
									Enkla Frågor
								</h2>
								<p className="text-sm text-gray-600">
									{archivedSessions.length} sessioner
								</p>
							</div>
						</div>
						<ChevronRight
							className={`w-6 h-6 text-gray-500 transition-transform ${
								expandedSections.sessions ? "rotate-90" : ""
							}`}
						/>
					</button>

					{expandedSections.sessions && (
						<div className="mt-3 ml-4">
							{archivedSessions.length === 0 ? (
								<div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
									Inga arkiverade sessioner än
								</div>
							) : (
								<div className="grid gap-4">
									{archivedSessions.map((archivedSession) => (
										<Link
											key={archivedSession._id}
											href={`/archive/${archivedSession._id}`}
											className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
										>
											<h3 className="font-semibold text-lg mb-2">
												{archivedSession.place}
											</h3>
											<div className="flex items-center gap-4 text-sm text-gray-600">
												{archivedSession.participantCount > 0 && (
													<div className="flex items-center gap-1">
														<Users className="w-4 h-4" />
														{archivedSession.participantCount}{" "}
														deltagare
													</div>
												)}
												{archivedSession.endDate && (
													<div className="flex items-center gap-1">
														<Calendar className="w-4 h-4" />
														{new Date(
															archivedSession.endDate
														).toLocaleDateString("sv-SE")}
													</div>
												)}
											</div>
										</Link>
									))}
								</div>
							)}
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
