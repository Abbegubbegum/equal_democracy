import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { ChevronsRight, ChevronRight } from "lucide-react";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";

function relativeTime(date) {
	const diff = Date.now() - new Date(date).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return "just nu";
	if (minutes < 60) return `${minutes} min sedan`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} tim sedan`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days} d sedan`;
	return new Date(date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { t } = useTranslation();
	const { theme } = useConfig();
	const [view, setView] = useState("home"); // 'home', 'apply-admin'
	const [latestItems, setLatestItems] = useState([]);

	const fetchLatestItems = useCallback(async () => {
		try {
			const res = await fetch("/api/recent");
			if (res.ok) {
				const data = await res.json();
				setLatestItems(Array.isArray(data) ? data : []);
			}
		} catch (error) {
			console.error("Error fetching latest items:", error);
		}
	}, []);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	useEffect(() => {
		if (session) {
			fetchLatestItems();
		}
	}, [session, fetchLatestItems]);

	const handleApplyForAdmin = async (
		name,
		organization,
		requestedSessions
	) => {
		try {
			const { fetchWithCsrf } = await import("../lib/fetch-with-csrf");
			const res = await fetchWithCsrf("/api/apply-admin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					organization,
					requestedSessions: parseInt(requestedSessions),
				}),
			});

			const data = await res.json();

			if (res.ok) {
				alert(t("admin.applicationSubmitted"));
				setView("home");
			} else {
				alert(data.message || t("errors.generic"));
			}
		} catch (error) {
			console.error("Error applying for admin:", error);
			alert(t("errors.generic"));
		}
	};

	if (status === "loading") {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center">
				<div className="text-xl text-gray-600">Laddar...</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	// Get theme colors
	const primaryColor = theme.colors.primary[600] || "#002d75";
	const accentColor = theme.colors.accent[400] || "#f8b60e";
	const primaryDark = theme.colors.primary[800] || "#001c55";

	if (view === "apply-admin") {
		return (
			<ApplyAdminView
				onSubmit={handleApplyForAdmin}
				onBack={() => setView("home")}
				userEmail={session.user.email}
				userName={session.user.name}
				t={t}
				theme={theme}
			/>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 overflow-x-hidden">
			{/* Header */}
			<div
				className="text-white p-4 sm:p-6 shadow-lg"
				style={{
					background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
				}}
			>
				<div className="max-w-4xl mx-auto">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
						<button
							onClick={() => router.push("/about")}
							className="flex flex-row items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
							title="Om Vallentuna Framåt"
						>
							<div
								className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
								style={{ backgroundColor: accentColor }}
							>
								<ChevronsRight
									className="w-11 h-11"
									strokeWidth={3}
									style={{ color: primaryDark }}
								/>
							</div>
							<div className="text-left">
								<div className="text-xl sm:text-2xl font-black tracking-widest leading-tight">VALLENTUNA</div>
								<div className="text-base sm:text-lg font-medium -mt-1">Framåt</div>
							</div>
						</button>
						<div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
							{session.user.isSuperAdmin && (
								<>
									<button
										onClick={() => router.push("/admin")}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.admin")}
									</button>
									<button
										onClick={() =>
											router.push("/manage-sessions")
										}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.manageSessions") ||
											"Manage Sessions"}
									</button>
								</>
							)}
							{session.user.isAdmin &&
								!session.user.isSuperAdmin && (
									<button
										onClick={() =>
											router.push("/manage-sessions")
										}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.manageSessions") ||
											"Manage Sessions"}
									</button>
								)}
							{!session.user.isAdmin &&
								!session.user.isSuperAdmin && (
									<button
										onClick={() => setView("apply-admin")}
										className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
									>
										{t("nav.applyForAdmin")}
									</button>
								)}
							<button
								onClick={() => signOut()}
								className="text-white hover:text-accent-400 whitespace-nowrap"
							>
								{t("auth.logout")}
							</button>
						</div>
					</div>
					<p className="text-white text-sm font-normal mt-3">
						{t("auth.hello")}, {session.user.name} – Välkommen att påverka!
					</p>
				</div>
			</div>

			{/* Quick Navigation */}
			<div className="max-w-4xl mx-auto p-4 sm:p-6">
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
					<button
						onClick={() => router.push("/vallentuna")}
						className="bg-white hover:bg-gray-50 p-4 rounded-lg shadow text-center transition-colors"
					>
						<div className="text-2xl mb-2">🏛️</div>
						<div className="font-semibold text-sm text-gray-800">
							Kommunen
						</div>
					</button>
					<button
						onClick={() => router.push("/medborgarforslag")}
						className="bg-white hover:bg-gray-50 p-4 rounded-lg shadow text-center transition-colors"
					>
						<div className="text-2xl mb-2">💡</div>
						<div className="font-semibold text-sm text-gray-800">
							Idéer
						</div>
					</button>
					<button
						onClick={() => router.push("/budget")}
						className="bg-white hover:bg-gray-50 p-4 rounded-lg shadow text-center transition-colors"
					>
						<div className="text-2xl mb-2">📊</div>
						<div className="font-semibold text-sm text-gray-800">
							Budget
						</div>
					</button>
					<button
						onClick={() => router.push("/archive")}
						className="bg-white hover:bg-gray-50 p-4 rounded-lg shadow text-center transition-colors"
					>
						<div className="text-2xl mb-2">📚</div>
						<div className="font-semibold text-sm text-gray-800">
							Arkiv
						</div>
					</button>
				</div>
			</div>

			{/* Latest contributions */}
			{latestItems.length > 0 && (
				<div className="max-w-4xl mx-auto px-4 sm:px-6 pb-8">
					<div className="bg-white rounded-lg shadow overflow-hidden">
						<div className="px-4 py-2 border-b bg-gray-50">
							<span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
								Senaste aktivitet
							</span>
						</div>
						{latestItems.map((item, i) => (
							<button
								key={i}
								onClick={() => router.push(item.link)}
								className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b last:border-b-0"
							>
								<span className="text-lg shrink-0">{item.icon}</span>
								<div className="min-w-0 flex-1">
									<span className="text-sm font-medium text-gray-800 block truncate">
										{item.title}
									</span>
									<span className="text-xs text-gray-500">
										{item.subtitle} · {relativeTime(item.date)}
									</span>
								</div>
								<ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
							</button>
						))}
						<button
							onClick={() => router.push("/archive")}
							className="w-full px-4 py-3 text-sm text-primary-600 hover:bg-gray-50 text-center font-medium transition-colors"
						>
							Se mer i Arkivet →
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// APPLY ADMIN VIEW
// ============================================================================

function ApplyAdminView({ onSubmit, onBack, userEmail, userName, t, theme }) {
	const [name, setName] = useState(userName || "");
	const [organization, setOrganization] = useState("");
	const [requestedSessions, setRequestedSessions] = useState("10");
	const [submitting, setSubmitting] = useState(false);

	const primaryColor = theme.colors.primary[600];
	const primaryDark = theme.colors.primary[900];
	const accentColor = theme.colors.accent[400];

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!name || !organization || !requestedSessions) {
			alert(t("errors.generic"));
			return;
		}

		const sessions = parseInt(requestedSessions);
		if (isNaN(sessions) || sessions < 1 || sessions > 50) {
			alert("Please enter a number between 1 and 50 for sessions");
			return;
		}

		setSubmitting(true);
		await onSubmit(name, organization, sessions);
		setSubmitting(false);
	};

	return (
		<div className="min-h-screen" style={{ backgroundColor: primaryColor }}>
			<div
				className="p-4 sm:p-6"
				style={{ backgroundColor: primaryDark }}
			>
				<div className="max-w-2xl mx-auto">
					<button
						onClick={onBack}
						className="text-white hover:text-accent-400 mb-4 flex items-center gap-2"
					>
						← {t("common.back")}
					</button>
					<h1 className="text-2xl sm:text-3xl font-bold text-white wrap-break-word">
						{t("admin.applyForAdmin")}
					</h1>
				</div>
			</div>

			<div className="max-w-2xl mx-auto p-4 sm:p-6">
				<form
					onSubmit={handleSubmit}
					className="bg-white rounded-2xl shadow-lg p-6 space-y-6"
				>
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("auth.email")}
						</label>
						<input
							type="email"
							value={userEmail}
							disabled
							className="w-full border border-slate-300 rounded-lg px-4 py-3 bg-slate-100 text-slate-600"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("auth.name")} *
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={t("auth.name")}
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("admin.organization")} *
						</label>
						<input
							type="text"
							value={organization}
							onChange={(e) => setOrganization(e.target.value)}
							className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={t("admin.organizationPlaceholder")}
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							{t("admin.requestedSessions")} * (1-50)
						</label>
						<input
							type="number"
							min="1"
							max="50"
							value={requestedSessions}
							onChange={(e) =>
								setRequestedSessions(e.target.value)
							}
							className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="10"
							required
						/>
						<p className="text-sm text-slate-500 mt-1">
							{t("admin.requestedSessionsHelp")}
						</p>
					</div>

					<button
						type="submit"
						disabled={submitting}
						className="w-full font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
						style={{
							backgroundColor: accentColor,
							color: primaryDark,
						}}
					>
						{submitting
							? t("common.submit") + "..."
							: t("common.submit")}
					</button>
				</form>
			</div>
		</div>
	);
}
