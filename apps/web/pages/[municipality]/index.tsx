import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Building2, Users, Calendar } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "../../lib/hooks/useTranslation";

const BOARD_INFO = {
	kommunfullmaktige: {
		name: "Kommunfullmäktige",
		description: "Kommunens högsta beslutande organ",
		icon: "🏛️",
	},
	kommunstyrelsen: {
		name: "Kommunstyrelsen",
		description: "Kommunens ledande förvaltningsorgan",
		icon: "💼",
	},
	"barn-och-ungdomsnamnden": {
		name: "Barn- och ungdomsnämnden",
		description: "Förskola, grundskola och fritidsverksamhet",
		icon: "👶",
	},
	socialnamnden: {
		name: "Socialnämnden",
		description: "Omsorg och stöd till medborgare",
		icon: "🤝",
	},
	"bygg-och-miljotillsynsnamnden": {
		name: "Bygg- och miljötillsynsnämnden",
		description: "Bygglov, miljötillsyn och samhällsplanering",
		icon: "🏗️",
	},
};

export default function MunicipalityPage() {
	const router = useRouter();
	const { municipality } = router.query;
	const { data: session, status } = useSession();
	const { t } = useTranslation();
	const [availableBoards, setAvailableBoards] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (status === "loading") return;
		if (!session) {
			router.replace("/login");
			return;
		}
		if (municipality) {
			fetchAvailableBoards();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status, session, municipality, router]);

	const fetchAvailableBoards = async () => {
		try {
			// Fetch all active municipal sessions for this municipality
			const res = await fetch(
				`/api/municipal/sessions?municipality=${municipality}&status=active`
			);
			const data = await res.json();
			const sessions = data.sessions || [];

			// Extract unique board types
			const boards = new Set();
			sessions.forEach((municipalSession) => {
				const boardSlug = municipalSession.meetingType
					.toLowerCase()
					.replace(/å/g, "a")
					.replace(/ä/g, "a")
					.replace(/ö/g, "o")
					.replace(/ /g, "-");
				boards.add(boardSlug);
			});

			// Get board info for available boards
			const boardList = Array.from(boards).map((boardSlug) => ({
				slug: boardSlug,
				...BOARD_INFO[boardSlug],
			}));

			setAvailableBoards(boardList);
		} catch (error) {
			console.error("Error fetching boards:", error);
		} finally {
			setLoading(false);
		}
	};

	if (status === "loading" || loading || !municipality) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-xl text-gray-600">Laddar...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-primary-600 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Building2 className="w-8 h-8" />
							<div>
								<h1 className="text-3xl font-bold capitalize">
									{municipality} Kommun
								</h1>
								<p className="text-primary-100">
									Alla nämnder och beslutsorgan
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

			<main className="max-w-6xl mx-auto p-6">
				{availableBoards.length === 0 ? (
					<div className="bg-white rounded-lg shadow p-12 text-center">
						<div className="text-6xl mb-4">🏛️</div>
						<h2 className="text-2xl font-bold text-gray-800 mb-2">
							Inga aktiva nämnder
						</h2>
						<p className="text-gray-600">
							Det finns inga aktiva nämnder för{" "}
							<span className="capitalize">{municipality}</span>{" "}
							kommun för tillfället.
						</p>
					</div>
				) : (
					<div>
						<h2 className="text-2xl font-bold text-gray-800 mb-6">
							Välj en nämnd
						</h2>
						<div className="grid md:grid-cols-2 gap-6">
							{availableBoards.map((board) => (
								<Link
									key={board.slug}
									href={`/${municipality}/${board.slug}`}
									className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
								>
									<div className="flex items-start gap-4">
										<div className="text-4xl">
											{board.icon || "📋"}
										</div>
										<div className="flex-1">
											<h3 className="text-xl font-bold text-gray-800 mb-2">
												{board.name ||
													board.slug
														.replace(/-/g, " ")
														.replace(/\b\w/g, (l) =>
															l.toUpperCase()
														)}
											</h3>
											<p className="text-gray-600 text-sm mb-4">
												{board.description ||
													"Kommunalt beslutsorgan"}
											</p>
											<div className="flex items-center gap-2 text-sm text-primary-600 font-medium">
												<Users className="w-4 h-4" />
												Visa aktiva frågor →
											</div>
										</div>
									</div>
								</Link>
							))}
						</div>
					</div>
				)}

				{/* Archive Link */}
				<div className="mt-8">
					<Link
						href="/archive"
						className="flex items-center gap-3 p-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
					>
						<Calendar className="w-6 h-6 text-gray-600" />
						<div>
							<h3 className="font-semibold text-gray-800">
								Visa arkiverade beslut
							</h3>
							<p className="text-sm text-gray-600">
								Alla avslutade frågor och beslut
							</p>
						</div>
					</Link>
				</div>
			</main>
		</div>
	);
}
