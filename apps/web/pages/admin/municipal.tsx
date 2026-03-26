import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
	Shield,
	FileText,
	Download,
	Edit,
	Trash2,
	CheckCircle,
	XCircle,
	AlertCircle,
	Send,
	Plus,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";

const CATEGORY_NAMES = {
	1: "Bygga, bo och miljö",
	2: "Fritid och kultur",
	3: "Förskola och skola",
	4: "Ändring av styrdokument",
	5: "Näringsliv och arbete",
	6: "Omsorg och hjälp",
	7: "Övrigt kommun och politik",
};

export default function MunicipalAdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [view, setView] = useState("list"); // 'list', 'extract', 'review'
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	// Extract form
	const [agendaUrl, setAgendaUrl] = useState("");
	const [municipality, setMunicipality] = useState("Vallentuna");
	const [meetingType, setMeetingType] = useState("Kommunfullmäktige");
	const [extracting, setExtracting] = useState(false);

	// Review session
	const [reviewSession, setReviewSession] = useState(null);
	const [editingItems, setEditingItems] = useState([]);

	useEffect(() => {
		if (status === "loading") return;
		if (!session) router.replace("/login");
		else if (!session.user?.isSuperAdmin) router.replace("/");
	}, [status, session, router]);

	useEffect(() => {
		if (session?.user?.isSuperAdmin) {
			fetchSessions();
		}
	}, [session]);

	const fetchSessions = async () => {
		try {
			const res = await fetch("/api/municipal/sessions");
			const data = await res.json();
			setSessions(data.sessions || []);
		} catch (err) {
			console.error("Error fetching sessions:", err);
		}
	};

	const handleExtract = async (e) => {
		e.preventDefault();
		setExtracting(true);
		setError("");
		setSuccess("");

		try {
			const res = await fetchWithCsrf("/api/municipal/extract-agenda", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: agendaUrl,
					municipality,
					meetingType,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				setSuccess(
					`Extraherade ${data.session.itemCount} ärenden från kallelsen!`
				);
				setAgendaUrl("");
				await fetchSessions();
				// Open the newly created session for review
				setReviewSession(data.session);
				setEditingItems(data.session.items);
				setView("review");
			} else {
				setError(data.message || "Misslyckades att extrahera kallelse");
			}
		} catch (err) {
			console.error("Error extracting agenda:", err);
			setError("Ett fel uppstod vid extrahering");
		} finally {
			setExtracting(false);
		}
	};

	const handlePublish = async () => {
		if (!reviewSession) return;

		setLoading(true);
		setError("");

		try {
			const res = await fetchWithCsrf("/api/municipal/sessions", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId: reviewSession._id,
					action: "update",
					updates: {
						items: editingItems,
					},
				}),
			});

			if (!res.ok) {
				throw new Error("Failed to save changes");
			}

			// Now publish
			const publishRes = await fetchWithCsrf("/api/municipal/sessions", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId: reviewSession._id,
					action: "publish",
				}),
			});

			const data = await publishRes.json();

			if (publishRes.ok) {
				setSuccess("Sessionen har publicerats!");
				await fetchSessions();
				setView("list");
				setReviewSession(null);
			} else {
				setError(data.message || "Misslyckades att publicera");
			}
		} catch (err) {
			console.error("Error publishing:", err);
			setError("Ett fel uppstod vid publicering");
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteSession = async (sessionId) => {
		if (!confirm("Är du säker på att du vill ta bort denna session?")) return;

		try {
			const res = await fetchWithCsrf(
				`/api/municipal/sessions?sessionId=${sessionId}`,
				{
					method: "DELETE",
				}
			);

			if (res.ok) {
				setSuccess("Session borttagen");
				await fetchSessions();
			} else {
				setError("Misslyckades att ta bort session");
			}
		} catch (err) {
			console.error("Error deleting:", err);
			setError("Ett fel uppstod");
		}
	};

	const updateItem = (index, field, value) => {
		const updated = [...editingItems];
		updated[index] = { ...updated[index], [field]: value };
		setEditingItems(updated);
	};

	const toggleCategory = (itemIndex, category) => {
		const updated = [...editingItems];
		const item = updated[itemIndex];
		const cats = item.categories || [];

		if (cats.includes(category)) {
			item.categories = cats.filter((c) => c !== category);
		} else {
			if (cats.length < 3) {
				item.categories = [...cats, category];
			}
		}
		setEditingItems(updated);
	};

	const removeItem = (index) => {
		setEditingItems(editingItems.filter((_, i) => i !== index));
	};

	const addItem = () => {
		setEditingItems([
			...editingItems,
			{
				originalNumber: "",
				title: "",
				description: "",
				categories: [],
				initialArguments: [],
			},
		]);
	};

	if (status === "loading") return <div className="p-8">Laddar...</div>;
	if (!session?.user?.isSuperAdmin) return null;

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-slate-800 text-white p-6 shadow">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-accent-400 rounded-full flex items-center justify-center">
							<Shield className="w-5 h-5 text-slate-900" />
						</div>
						<div>
							<h1 className="text-2xl font-bold">
								Kommunala Kallelser
							</h1>
							<p className="text-slate-300 text-sm">
								Extrahera och publicera ärenden från kommunfullmäktige
							</p>
						</div>
					</div>
					<button
						onClick={() => router.push("/admin")}
						className="px-4 py-2 bg-white hover:bg-gray-100 text-slate-900 font-medium rounded-lg transition-colors"
					>
						Tillbaka till Admin
					</button>
				</div>
			</header>

			<main className="max-w-7xl mx-auto p-6">
				{/* Alerts */}
				{error && (
					<div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
						<XCircle className="w-5 h-5" />
						{error}
					</div>
				)}
				{success && (
					<div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
						<CheckCircle className="w-5 h-5" />
						{success}
					</div>
				)}

				{/* Navigation */}
				<div className="mb-6 flex gap-2">
					<button
						onClick={() => setView("list")}
						className={`px-4 py-2 rounded-lg font-medium transition-colors ${
							view === "list"
								? "bg-primary-600 text-white"
								: "bg-white text-gray-700 hover:bg-gray-100"
						}`}
					>
						<FileText className="w-4 h-4 inline mr-2" />
						Sessioner
					</button>
					<button
						onClick={() => setView("extract")}
						className={`px-4 py-2 rounded-lg font-medium transition-colors ${
							view === "extract"
								? "bg-primary-600 text-white"
								: "bg-white text-gray-700 hover:bg-gray-100"
						}`}
					>
						<Download className="w-4 h-4 inline mr-2" />
						Extrahera Kallelse
					</button>
				</div>

				{/* List View */}
				{view === "list" && (
					<div className="bg-white rounded-lg shadow p-6">
						<h2 className="text-xl font-bold mb-4">Alla Sessioner</h2>
						{sessions.length === 0 ? (
							<p className="text-gray-500">Inga sessioner ännu</p>
						) : (
							<div className="space-y-3">
								{sessions.map((s) => (
									<div
										key={s._id}
										className="border rounded-lg p-4 hover:bg-gray-50"
									>
										<div className="flex items-start justify-between">
											<div>
												<h3 className="font-semibold text-lg">
													{s.name}
												</h3>
												<p className="text-sm text-gray-600">
													{new Date(
														s.meetingDate
													).toLocaleDateString("sv-SE")}
													{" • "}
													{s.items.length} ärenden
													{" • "}
													<span
														className={`inline-block px-2 py-0.5 rounded text-xs ${
															s.status === "draft"
																? "bg-yellow-100 text-yellow-800"
																: s.status === "active"
																	? "bg-green-100 text-green-800"
																	: "bg-gray-100 text-gray-800"
														}`}
													>
														{s.status}
													</span>
												</p>
											</div>
											<div className="flex gap-2">
												{s.status === "draft" && (
													<>
														<button
															onClick={() => {
																setReviewSession(s);
																setEditingItems(
																	s.items
																);
																setView("review");
															}}
															className="p-2 text-blue-600 hover:bg-blue-50 rounded"
															title="Granska"
														>
															<Edit className="w-4 h-4" />
														</button>
														<button
															onClick={() =>
																handleDeleteSession(
																	s._id
																)
															}
															className="p-2 text-red-600 hover:bg-red-50 rounded"
															title="Ta bort"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* Extract View */}
				{view === "extract" && (
					<div className="bg-white rounded-lg shadow p-6">
						<h2 className="text-xl font-bold mb-4">
							Extrahera Ärenden från Kallelse
						</h2>
						<form onSubmit={handleExtract} className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-2">
									URL till PDF-kallelse
								</label>
								<input
									type="url"
									value={agendaUrl}
									onChange={(e) => setAgendaUrl(e.target.value)}
									placeholder="https://dok.vallentuna.se/file/..."
									className="w-full px-4 py-2 border rounded-lg"
									required
								/>
								<p className="text-xs text-gray-500 mt-1">
									T.ex: https://dok.vallentuna.se/file/demokrati/sammanträdeshandlingar/...
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Kommun
								</label>
								<input
									type="text"
									value={municipality}
									onChange={(e) => setMunicipality(e.target.value)}
									placeholder="T.ex. Vallentuna"
									className="w-full px-4 py-2 border rounded-lg"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Mötestyp
								</label>
								<select
									value={meetingType}
									onChange={(e) => setMeetingType(e.target.value)}
									className="w-full px-4 py-2 border rounded-lg"
								>
									<option>Kommunfullmäktige</option>
									<option>Kommunstyrelsen</option>
									<option>Barn- och ungdomsnämnden</option>
									<option>Socialnämnden</option>
								</select>
							</div>

							<button
								type="submit"
								disabled={extracting || !agendaUrl}
								className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
							>
								{extracting ? (
									"Extraherar..."
								) : (
									<>
										<Download className="w-5 h-5 inline mr-2" />
										Extrahera Ärenden
									</>
								)}
							</button>
						</form>

						<div className="mt-6 p-4 bg-blue-50 rounded-lg">
							<div className="flex items-start gap-2">
								<AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
								<div className="text-sm text-blue-900">
									<p className="font-semibold mb-1">Så fungerar det:</p>
									<ol className="list-decimal list-inside space-y-1">
										<li>AI:n läser PDF:en och filtrerar bort formalia (§1-8)</li>
										<li>Ärendena omformuleras till aktiva frågor</li>
										<li>Kategorier tilldelas automatiskt</li>
										<li>Du granskar och publicerar</li>
									</ol>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Review View */}
				{view === "review" && reviewSession && (
					<div className="bg-white rounded-lg shadow p-6">
						<div className="flex items-center justify-between mb-6">
							<div>
								<h2 className="text-xl font-bold">
									Granska Ärenden
								</h2>
								<p className="text-sm text-gray-600">
									{reviewSession.name} • {editingItems.length} ärenden
								</p>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => setView("list")}
									className="px-4 py-2 border rounded-lg hover:bg-gray-50"
								>
									Avbryt
								</button>
								<button
									onClick={handlePublish}
									disabled={loading}
									className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2"
								>
									<Send className="w-4 h-4" />
									Publicera Session
								</button>
							</div>
						</div>

						<div className="space-y-6">
							{editingItems.map((item, index) => (
								<div
									key={index}
									className="border rounded-lg p-4 bg-gray-50 relative"
								>
									<div className="mb-3 flex items-start justify-between">
										<span className="text-xs text-gray-500 font-mono">
											{item.originalNumber}
										</span>
										<button
											onClick={() => removeItem(index)}
											className="p-1 text-red-500 hover:bg-red-50 rounded"
											title="Ta bort ärende"
										>
											<Trash2 className="w-4 h-4" />
										</button>
									</div>

									<div className="space-y-3">
										<div>
											<label className="block text-sm font-medium mb-1">
												Rubrik (aktiv formulering)
											</label>
											<input
												type="text"
												value={item.title}
												onChange={(e) =>
													updateItem(
														index,
														"title",
														e.target.value
													)
												}
												className="w-full px-3 py-2 border rounded"
											/>
										</div>

										<div>
											<label className="block text-sm font-medium mb-1">
												Beskrivning
											</label>
											<textarea
												value={item.description}
												onChange={(e) =>
													updateItem(
														index,
														"description",
														e.target.value
													)
												}
												rows={3}
												className="w-full px-3 py-2 border rounded"
											/>
										</div>

										<div>
											<label className="block text-sm font-medium mb-2">
												Kategorier (max 3)
											</label>
											<div className="flex flex-wrap gap-2">
												{[1, 2, 3, 4, 5, 6, 7].map((cat) => {
													const isSelected =
														item.categories?.includes(cat);
													return (
														<button
															key={cat}
															type="button"
															onClick={() =>
																toggleCategory(index, cat)
															}
															className={`px-3 py-1 rounded-full text-sm transition-colors ${
																isSelected
																	? "bg-primary-600 text-white"
																	: "bg-gray-200 text-gray-700 hover:bg-gray-300"
															}`}
														>
															{cat}. {CATEGORY_NAMES[cat]}
														</button>
													);
												})}
											</div>
										</div>

										{item.initialArguments?.length > 0 && (
											<div>
												<label className="block text-sm font-medium mb-1">
													Initiala argument
												</label>
												<div className="space-y-1">
													{item.initialArguments.map((arg, i) => (
														<div
															key={i}
															className={`text-sm p-2 rounded ${
																arg.type === "for"
																	? "bg-green-50 text-green-800"
																	: "bg-red-50 text-red-800"
															}`}
														>
															<strong>
																{arg.type === "for"
																	? "För:"
																	: "Emot:"}
															</strong>{" "}
															{arg.text}
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
							))}

							<button
								onClick={addItem}
								className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
							>
								<Plus className="w-4 h-4" />
								Lägg till ärende
							</button>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
