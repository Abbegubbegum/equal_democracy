import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Calendar, TrendingUp, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "../../../lib/hooks/useTranslation";

const CATEGORY_NAMES = {
	1: "Bygga, bo och miljö",
	2: "Fritid och kultur",
	3: "Förskola och skola",
	4: "Ändring av styrdokument",
	5: "Näringsliv och arbete",
	6: "Omsorg och hjälp",
	7: "Övrigt kommun och politik",
};

export default function BoardArchivePage() {
	const router = useRouter();
	const { municipality, board } = router.query;
	const { t } = useTranslation();
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (municipality && board) {
			fetchArchivedSessions();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [municipality, board]);

	const fetchArchivedSessions = async () => {
		try {
			const res = await fetch(
				`/api/municipal/board-sessions?municipality=${municipality}&board=${board}&status=closed`
			);
			const data = await res.json();
			setSessions(data.sessions || []);
		} catch (error) {
			console.error("Error fetching sessions:", error);
		} finally {
			setLoading(false);
		}
	};

	if (!municipality || !board) {
		return <div className="p-8">Laddar...</div>;
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-slate-700 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold mb-2 capitalize">
								{board.replace(/-/g, " ")} - Arkiv
							</h1>
							<p className="text-slate-300 capitalize">
								{municipality} kommun
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
				{/* Navigation */}
				<div className="mb-6 flex gap-2">
					<Link
						href={`/${municipality}/${board}`}
						className="px-4 py-2 bg-white text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
					>
						<TrendingUp className="w-4 h-4 inline mr-2" />
						Aktiva Frågor
					</Link>
					<button className="px-4 py-2 bg-white text-slate-700 shadow rounded-lg font-medium">
						<CheckCircle className="w-4 h-4 inline mr-2" />
						Arkiv
					</button>
				</div>

				{/* Archived Sessions */}
				{loading ? (
					<div className="text-center py-12 text-gray-500">
						Laddar...
					</div>
				) : sessions.length === 0 ? (
					<div className="bg-white rounded-lg shadow p-12 text-center">
						<p className="text-gray-500 mb-4">
							Inga arkiverade frågor ännu
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{sessions.map((municipalSession) => (
							<div key={municipalSession._id} className="space-y-4">
								{municipalSession.items
									.filter((item) => item.status === "closed")
									.map((item, idx) => {
										// Format date for each item
										const itemDate = new Date(
											municipalSession.meetingDate
										).toLocaleDateString("sv-SE", {
											year: "numeric",
											month: "2-digit",
											day: "2-digit",
										});
										const itemTime =
											municipalSession.meetingTime || "18:00";
										const dateTimeStr = `${itemDate} ${itemTime}`;

										return (
											<div
												key={idx}
												className="border-l-4 border-gray-400 pl-4 hover:bg-gray-50 p-4 rounded bg-white shadow-sm"
											>
												<div className="flex items-start justify-between mb-2">
													<div className="flex-1">
														<div className="flex items-center gap-2 mb-1">
															<Calendar className="w-4 h-4 text-gray-500" />
															<span className="text-sm font-medium text-gray-600">
																{dateTimeStr}
															</span>
															<span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full ml-2">
																Avslutad
															</span>
														</div>
														<h3 className="font-bold text-xl mb-2 text-gray-900">
															{item.title}
														</h3>
													</div>
												</div>
												<p className="text-gray-700 mb-3 leading-relaxed">
													{item.description}
												</p>
												<div className="flex flex-wrap gap-2 mb-3">
													{item.categories.map((cat) => (
														<span
															key={cat}
															className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full"
														>
															{CATEGORY_NAMES[cat]}
														</span>
													))}
												</div>
												{item.closedAt && (
													<p className="text-xs text-gray-500 mb-2">
														Avslutad:{" "}
														{new Date(item.closedAt).toLocaleDateString("sv-SE")}
													</p>
												)}
												{item.sessionId && (
													<Link
														href={`/session/${item.sessionId}`}
														className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
													>
														Visa Resultat
													</Link>
												)}
											</div>
										);
									})}
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
