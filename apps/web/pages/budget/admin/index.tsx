import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Wallet, List, Settings } from "lucide-react";
import { fetchWithCsrf } from "../../../lib/fetch-with-csrf";

export default function BudgetAdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [tab, setTab] = useState("sessions");
	const [theme, setTheme] = useState('green');

	useEffect(() => {
		if (status === "loading") return;
		if (!session) router.replace("/login");
		else if (!session.user?.isSuperAdmin) router.replace("/");
	}, [status, session, router]);

	useEffect(() => {
		// Fetch theme settings
		async function fetchTheme() {
			try {
				const response = await fetch("/api/settings");
				const data = await response.json();
				if (response.ok && data.theme) {
					setTheme(data.theme);
				}
			} catch (error) {
				console.error("Failed to fetch theme:", error);
			}
		}
		fetchTheme();
	}, []);

	// Get theme color classes
	const getThemeClasses = () => {
		switch (theme) {
			case 'red':
				return {
					bg: 'bg-red-800',
					bgLight: 'bg-red-400',
					text: 'text-red-200',
					textDark: 'text-red-900'
				};
			case 'blue':
				return {
					bg: 'bg-blue-800',
					bgLight: 'bg-blue-400',
					text: 'text-blue-200',
					textDark: 'text-blue-900'
				};
			case 'green':
			default:
				return {
					bg: 'bg-emerald-800',
					bgLight: 'bg-emerald-400',
					text: 'text-emerald-200',
					textDark: 'text-emerald-900'
				};
		}
	};

	const themeColors = getThemeClasses();

	if (status === "loading") return <div className="p-8">Loading…</div>;
	if (!session?.user?.isSuperAdmin) return null;

	return (
		<div className="min-h-screen bg-gray-50">
			<header className={`${themeColors.bg} text-white p-6 shadow`}>
				<div className="max-w-6xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className={`w-10 h-10 ${themeColors.bgLight} rounded-full flex items-center justify-center`}>
							<Wallet className={`w-5 h-5 ${themeColors.textDark}`} />
						</div>
						<div>
							<h1 className="text-2xl font-bold">Budget Admin</h1>
							<p className={`${themeColors.text} text-sm`}>
								AI-powered median budget voting sessions
							</p>
						</div>
					</div>
					<button
						onClick={() => router.push("/budget")}
						className={`px-4 py-2 bg-white hover:bg-gray-100 ${themeColors.textDark} font-medium rounded-lg transition-colors shadow-sm`}
					>
						To Budget
					</button>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				<nav className="flex gap-2 flex-wrap">
					<Tab
						label="Sessions"
						icon={<List className="w-4 h-4" />}
						active={tab === "sessions"}
						onClick={() => setTab("sessions")}
					/>
					<Tab
						label="Settings"
						icon={<Settings className="w-4 h-4" />}
						active={tab === "settings"}
						onClick={() => setTab("settings")}
					/>
				</nav>

				{tab === "sessions" && <SessionsPanel />}
				{tab === "settings" && <SettingsPanel />}
			</main>
		</div>
	);
}

function Tab({ label, icon, active, onClick }) {
	return (
		<button
			onClick={onClick}
			className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
				active
					? "bg-emerald-100 text-emerald-900 border-2 border-emerald-500"
					: "bg-white text-gray-700 border-2 border-gray-200 hover:border-emerald-300"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}

function SessionsPanel() {
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showCreateForm, setShowCreateForm] = useState(false);

	useEffect(() => {
		fetchSessions();
	}, []);

	async function fetchSessions() {
		try {
			setLoading(true);
			const response = await fetch("/api/budget/sessions");
			const data = await response.json();

			if (response.ok) {
				setSessions(data.sessions);
			} else {
				setError(data.message);
			}
		} catch {
			setError("Failed to fetch sessions");
		} finally {
			setLoading(false);
		}
	}

	async function handleStatusChange(session, newStatus) {
		try {
			const response = await fetchWithCsrf("/api/budget/sessions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId: session.sessionId, status: newStatus }),
			});

			const data = await response.json();

			if (response.ok) {
				fetchSessions();
			} else {
				alert(data.message);
			}
		} catch {
			alert("Failed to update session status");
		}
	}

	async function handleDelete(session) {
		if (!confirm("Are you sure you want to delete this session?")) return;

		try {
			const response = await fetchWithCsrf(
				`/api/budget/sessions?sessionId=${session.sessionId}`,
				{ method: "DELETE" }
			);

			const data = await response.json();

			if (response.ok) {
				fetchSessions();
			} else {
				alert(data.message);
			}
		} catch {
			alert("Failed to delete session");
		}
	}

	if (loading) return <div className="text-center p-8">Loading sessions...</div>;

	return (
		<div className="bg-white rounded-xl shadow-sm p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-bold text-gray-900">Budget Sessions</h2>
				<button
					onClick={() => setShowCreateForm(!showCreateForm)}
					className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
				>
					{showCreateForm ? "Cancel" : "Create New Session"}
				</button>
			</div>

			{error && (
				<div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
					{error}
				</div>
			)}

			{showCreateForm && (
				<CreateSessionForm
					onSuccess={() => {
						setShowCreateForm(false);
						fetchSessions();
					}}
					onCancel={() => setShowCreateForm(false)}
				/>
			)}

			<div className="space-y-4 mt-6">
				{sessions.length === 0 ? (
					<p className="text-gray-500 text-center py-8">
						No budget sessions yet. Create one to get started.
					</p>
				) : (
					sessions.map((session) => (
						<SessionCard
							key={session._id}
							session={session}
							onStatusChange={handleStatusChange}
							onDelete={handleDelete}
						/>
					))
				)}
			</div>
		</div>
	);
}

function SessionCard({ session, onStatusChange, onDelete }) {
	const router = useRouter();
	const statusColors = {
		draft: "bg-gray-100 text-gray-700",
		active: "bg-green-100 text-green-700",
		closed: "bg-blue-100 text-blue-700",
	};

	const displayId = session.sessionId;

	return (
		<div className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 transition-colors">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						<h3
							className="text-lg font-semibold text-gray-900 hover:text-emerald-600 cursor-pointer transition-colors"
							onClick={() => router.push(`/budget/${displayId}`)}
						>
							{session.name}
						</h3>
						<span
							className={`px-2 py-1 rounded-full text-xs font-medium ${
								statusColors[session.status]
							}`}
						>
							{session.status}
						</span>
					</div>
					<p className="text-sm text-gray-600 mb-2">{session.municipality}</p>
					<p className="text-xs text-gray-400 mb-2 font-mono">ID: {displayId}</p>
					<p className="text-sm text-gray-500">
						Total Budget: {(session.totalBudget / 1000000).toFixed(1)} mnkr
					</p>
					<p className="text-sm text-gray-500">
						Categories: {session.categories?.length || 0} |{" "}
						Income sources: {session.incomeCategories?.length || 0}
					</p>
				</div>
				<div className="flex flex-col gap-2">
					{session.status === "draft" && (
						<button
							onClick={() => onStatusChange(session, "active")}
							className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
						>
							Activate
						</button>
					)}
					{session.status === "active" && (
						<button
							onClick={() => onStatusChange(session, "closed")}
							className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
						>
							Close Voting
						</button>
					)}
					{session.status === "closed" && (
						<button
							onClick={() => router.push(`/budget/results/${displayId}`)}
							className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
						>
							View Results
						</button>
					)}
					{session.status === "draft" && (
						<button
							onClick={() => onDelete(session)}
							className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
						>
							Delete
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

function CreateSessionForm({ onSuccess, onCancel }) {
	const [formData, setFormData] = useState({
		name: "",
		municipality: "",
		description: "",
	});
	const [pdf, setPdf] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState("");
	const [uploadStatus, setUploadStatus] = useState("");

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");
		setUploadStatus("");

		if (!pdf) {
			setError("Please upload a PDF file");
			return;
		}

		try {
			setSubmitting(true);
			setProcessing(true);

			// Step 1: Extract data from PDF using AI
			setUploadStatus("Processing PDF with AI...");
			const formDataPdf = new FormData();
			formDataPdf.append("pdf", pdf);
			formDataPdf.append("documentType", "expenses");

			const pdfResponse = await fetch("/api/budget/upload-pdf", {
				method: "POST",
				body: formDataPdf,
			});

			const pdfResult = await pdfResponse.json();
			if (!pdfResponse.ok) {
				throw new Error(pdfResult.message || "Failed to process PDF");
			}
			const extractedData = pdfResult.data;

			// Step 2: Create budget session with extracted data
			setUploadStatus("Creating budget session...");

			const totalBudget = extractedData?.totalBudget || 0;
			const categories = extractedData?.categories || [];
			const incomeCategories = extractedData?.incomeCategories || [];

			// Calculate Tax Base from AI-extracted data
			// Tax Base = Skatteintäkter / Skattesats (kr)
			let taxBase = undefined;
			let defaultTaxRateKr = 19;
			let minTaxRateKr = 18;
			let maxTaxRateKr = 21;

			if (extractedData?.taxRateKr && incomeCategories.length > 0) {
				// Find skatteintäkter category
				const taxIncome = incomeCategories.find(cat =>
					cat.isTaxRate || cat.name.toLowerCase().includes("skatt")
				);

				if (taxIncome && taxIncome.amount > 0 && extractedData.taxRateKr > 0) {
					// Calculate Tax Base: amount / taxRate
					taxBase = Math.round(taxIncome.amount / extractedData.taxRateKr);
					defaultTaxRateKr = extractedData.taxRateKr;

					// Set reasonable min/max ranges (±10% of default rate)
					minTaxRateKr = Math.max(1, Math.round((defaultTaxRateKr * 0.9) * 100) / 100);
					maxTaxRateKr = Math.round((defaultTaxRateKr * 1.1) * 100) / 100;

					console.log('Tax configuration calculated:', {
						taxBase,
						defaultTaxRateKr,
						minTaxRateKr,
						maxTaxRateKr,
						taxIncomeAmount: taxIncome.amount
					});
				}
			}

			const response = await fetchWithCsrf("/api/budget/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					municipality: formData.municipality,
					totalBudget,
					categories,
					incomeCategories,
					taxBase,
					defaultTaxRateKr,
					minTaxRateKr,
					maxTaxRateKr,
				}),
			});

			const data = await response.json();

			if (response.ok) {
				setUploadStatus("Session created successfully!");
				setTimeout(() => onSuccess(), 1000);
			} else {
				setError(data.message);
			}
		} catch (err) {
			setError(err.message || "Failed to create session");
			console.error("Error creating session:", err);
		} finally {
			setSubmitting(false);
			setProcessing(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-6 mb-6 space-y-4">
			<h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Budget Session</h3>

			{error && (
				<div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
					{error}
				</div>
			)}

			{uploadStatus && (
				<div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
					{uploadStatus}
				</div>
			)}

			<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
				<p className="font-medium mb-2">How it works:</p>
				<ol className="list-decimal list-inside space-y-1">
					<li>Upload PDF with budget data (expenses and income)</li>
					<li>AI extracts all categories, amounts, and tax rate automatically</li>
					<li>Tax configuration is calculated from extracted data (Skatteintäkter ÷ Skattesats)</li>
					<li>Budget session is created and ready for voting</li>
				</ol>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Session Name *
				</label>
				<input
					type="text"
					value={formData.name}
					onChange={(e) => setFormData({ ...formData, name: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="Vallentuna Budget 2025"
					required
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Municipality / Organization *
				</label>
				<input
					type="text"
					value={formData.municipality}
					onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="Vallentuna kommun, Företag AB, etc."
					required
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Description (optional)
				</label>
				<textarea
					value={formData.description}
					onChange={(e) => setFormData({ ...formData, description: e.target.value })}
					className="w-full p-2 border border-gray-300 rounded-lg"
					placeholder="Brief description of this budget session..."
					rows={2}
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-2">
					Upload PDF *
				</label>
				<input
					type="file"
					accept=".pdf"
					onChange={(e) => setPdf(e.target.files[0])}
					className="w-full p-2 border border-gray-300 rounded-lg"
				/>
				{pdf && (
					<p className="text-xs text-green-600 mt-1">
						✓ {pdf.name}
					</p>
				)}
				<p className="text-xs text-gray-500 mt-1">
					Upload budget PDF (Driftredovisning) with committee expenses
				</p>
			</div>

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={submitting}
					className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
				>
					{processing && (
						<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
					)}
					{submitting ? "Creating Session..." : "Create Session with AI"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					disabled={submitting}
					className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function SettingsPanel() {
	const [language, setLanguage] = useState("sv");
	const [theme, setTheme] = useState("green");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		fetchSettings();
	}, []);

	async function fetchSettings() {
		try {
			const response = await fetch("/api/settings");
			const data = await response.json();
			if (response.ok) {
				setLanguage(data.language || "sv");
				setTheme(data.theme || "green");
			}
		} catch (error) {
			console.error("Failed to fetch settings:", error);
		} finally {
			setLoading(false);
		}
	}

	async function saveSettings(newLanguage, newTheme) {
		try {
			setSaving(true);
			setMessage("");
			const response = await fetchWithCsrf("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					language: newLanguage,
					theme: newTheme,
				}),
			});

			if (response.ok) {
				setMessage("Settings saved successfully!");
				setTimeout(() => setMessage(""), 3000);
			} else {
				const data = await response.json();
				setMessage(`Error: ${data.error}`);
			}
		} catch (error) {
			setMessage("Failed to save settings");
			console.error("Failed to save settings:", error);
		} finally {
			setSaving(false);
		}
	}

	const handleLanguageChange = async (newLanguage) => {
		setLanguage(newLanguage);
		await saveSettings(newLanguage, theme);
	};

	const handleThemeChange = async (newTheme) => {
		setTheme(newTheme);
		await saveSettings(language, newTheme);
	};

	if (loading) {
		return <div className="bg-white rounded-xl shadow-sm p-6">Loading settings...</div>;
	}

	return (
		<div className="bg-white rounded-xl shadow-sm p-6">
			<h2 className="text-xl font-bold text-gray-900 mb-6">Budget Settings</h2>

			{saving && (
				<div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg">
					Saving settings...
				</div>
			)}

			{message && (
				<div className={`mb-4 p-3 rounded-lg ${
					message.includes("Error")
						? "bg-red-50 text-red-700"
						: "bg-green-50 text-green-700"
				}`}>
					{message}
				</div>
			)}

			<div className="space-y-6">
				{/* Language Selection */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-3">
						Language / Språk
					</label>
					<div className="flex gap-3">
						<button
							onClick={() => handleLanguageChange("sv")}
							disabled={saving}
							className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
								language === "sv"
									? "border-emerald-500 bg-emerald-50 text-emerald-900"
									: "border-gray-200 bg-white text-gray-700 hover:border-emerald-300"
							} ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
						>
							Svenska
						</button>
						<button
							onClick={() => handleLanguageChange("en")}
							disabled={saving}
							className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
								language === "en"
									? "border-emerald-500 bg-emerald-50 text-emerald-900"
									: "border-gray-200 bg-white text-gray-700 hover:border-emerald-300"
							} ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
						>
							English
						</button>
					</div>
					<p className="text-xs text-gray-500 mt-2">
						{language === "sv"
							? "Välj språk för budgetgränssnittet"
							: "Select language for the budget interface"}
					</p>
				</div>

				{/* Theme Selection */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-3">
						{language === "sv" ? "Färgtema för header" : "Header Color Theme"}
					</label>
					<div className="grid grid-cols-3 gap-3">
						<button
							onClick={() => handleThemeChange("green")}
							disabled={saving}
							className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
								theme === "green"
									? "border-emerald-500 bg-emerald-50 text-emerald-900"
									: "border-gray-200 bg-white text-gray-700 hover:border-emerald-300"
							} ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
						>
							<div className="flex items-center justify-center gap-2">
								<div className="w-4 h-4 rounded-full bg-emerald-600"></div>
								{language === "sv" ? "Grön" : "Green"}
							</div>
						</button>
						<button
							onClick={() => handleThemeChange("red")}
							disabled={saving}
							className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
								theme === "red"
									? "border-red-500 bg-red-50 text-red-900"
									: "border-gray-200 bg-white text-gray-700 hover:border-red-300"
							} ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
						>
							<div className="flex items-center justify-center gap-2">
								<div className="w-4 h-4 rounded-full bg-red-600"></div>
								{language === "sv" ? "Röd" : "Red"}
							</div>
						</button>
						<button
							onClick={() => handleThemeChange("blue")}
							disabled={saving}
							className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
								theme === "blue"
									? "border-blue-500 bg-blue-50 text-blue-900"
									: "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
							} ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
						>
							<div className="flex items-center justify-center gap-2">
								<div className="w-4 h-4 rounded-full bg-blue-600"></div>
								{language === "sv" ? "Blå" : "Blue"}
							</div>
						</button>
					</div>
					<p className="text-xs text-gray-500 mt-2">
						{language === "sv"
							? "Välj färgtema för header i budgetapplikationen"
							: "Select color theme for the budget application header"}
					</p>
				</div>
			</div>
		</div>
	);
}
