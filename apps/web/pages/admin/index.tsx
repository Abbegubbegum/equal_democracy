import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
	Shield,
	Users,
	Settings,
	Calendar,
	Trophy,
	Mail,
	PlusCircle,
	Wallet,
	BarChart3,
	FileText,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";
import { useTranslation } from "../../lib/hooks/useTranslation";

export default function AdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { t } = useTranslation();
	const [tab, setTab] = useState("sessions");

	useEffect(() => {
		if (status === "loading") return;
		if (!session) router.replace("/login");
		// Redirect session admins to manage-sessions page
		else if (session.user?.isAdmin && !session.user?.isSuperAdmin)
			router.replace("/manage-sessions");
		// Only allow super admins on this page
		else if (!session.user?.isSuperAdmin) router.replace("/");
	}, [status, session, router]);

	if (status === "loading") return <div className="p-8">Loading…</div>;
	if (!session?.user?.isSuperAdmin) return null;

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-slate-800 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-accent-400 rounded-full flex items-center justify-center">
							<Shield className="w-5 h-5 text-slate-900" />
						</div>
						<div>
							<h1 className="text-2xl font-bold">
								Super Admin Panel
							</h1>
							<p className="text-slate-300 text-sm">
								Full control over users, sessions, and system
								settings
							</p>
						</div>
					</div>
					<button
						onClick={() => router.push("/")}
						className="px-4 py-2 bg-white hover:bg-gray-100 text-slate-900 font-medium rounded-lg transition-colors shadow-sm"
					>
						Back to home
					</button>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				<nav className="flex gap-2 flex-wrap">
					<Tab
						label="Sessions"
						icon={<Calendar className="w-4 h-4" />}
						active={tab === "sessions"}
						onClick={() => setTab("sessions")}
					/>
					<Tab
						label="Kallelser"
						icon={<FileText className="w-4 h-4" />}
						active={tab === "municipal"}
						onClick={() => router.push("/admin/municipal")}
					/>
					<Tab
						label="Budget Admin"
						icon={<Wallet className="w-4 h-4" />}
						active={tab === "budget"}
						onClick={() => router.push("/budget/admin")}
					/>
					<Tab
						label="Survey"
						icon={<BarChart3 className="w-4 h-4" />}
						active={tab === "survey"}
						onClick={() => router.push("/admin/survey")}
					/>
					<Tab
						label="Top Proposals"
						icon={<Trophy className="w-4 h-4" />}
						active={tab === "top-proposals"}
						onClick={() => setTab("top-proposals")}
					/>
					<Tab
						label="Admin Applications"
						icon={<Shield className="w-4 h-4" />}
						active={tab === "admin-applications"}
						onClick={() => setTab("admin-applications")}
					/>
					<Tab
						label="Session Requests"
						icon={<PlusCircle className="w-4 h-4" />}
						active={tab === "session-requests"}
						onClick={() => setTab("session-requests")}
					/>
					<Tab
						label="Email"
						icon={<Mail className="w-4 h-4" />}
						active={tab === "email"}
						onClick={() => setTab("email")}
					/>
					<Tab
						label="Users"
						icon={<Users className="w-4 h-4" />}
						active={tab === "users"}
						onClick={() => setTab("users")}
					/>
					<Tab
						label="Settings"
						icon={<Settings className="w-4 h-4" />}
						active={tab === "settings"}
						onClick={() => setTab("settings")}
					/>
				</nav>

				{tab === "sessions" && <SessionsPanel t={t} />}
				{tab === "top-proposals" && <TopProposalsPanel />}
				{tab === "admin-applications" && <AdminApplicationsPanel />}
				{tab === "session-requests" && <SessionRequestsPanel />}
				{tab === "email" && <EmailPanel />}
				{tab === "settings" && <SettingsPanel isSuperAdmin={true} />}
				{tab === "users" && <UsersPanel />}
			</main>
		</div>
	);
}

function Tab({ label, icon, active, onClick }) {
	return (
		<button
			onClick={onClick}
			className={`px-4 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 ${
				active
					? "bg-white border-slate-300 shadow"
					: "bg-slate-100 border-slate-200 hover:bg-white"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}

function SettingsPanel({ isSuperAdmin }) {
	const [sessionLimitHours, setSessionLimitHours] = useState(24);
	const [language, setLanguage] = useState("sv");
	const [theme, setTheme] = useState("default");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");

	const loadSettings = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/settings");
			if (res.ok) {
				const data = await res.json();
				setSessionLimitHours(data.sessionLimitHours || 24);
				setLanguage(data.language || "sv");
				setTheme(data.theme || "default");
			} else {
				console.error("Error loading settings:", res.status);
			}
		} catch (error) {
			console.error("Error loading settings:", error);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadSettings();
	}, [loadSettings]);

	const handleSave = async () => {
		// Only validate sessionLimit if user is superadmin
		if (isSuperAdmin) {
			const hours = Number(sessionLimitHours);
			if (isNaN(hours) || hours < 1 || hours > 168) {
				setMessage(
					"Error: Session limit must be between 1 and 168 hours"
				);
				return;
			}
		}

		setSaving(true);
		setMessage("");
		try {
			const body = {
				language,
				theme,
			};

			// Only include sessionLimitHours if user is superadmin
			if (isSuperAdmin) {
				body.sessionLimitHours = Number(sessionLimitHours);
			}

			const res = await fetchWithCsrf("/api/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (res.ok) {
				setMessage("Settings saved! Färgerna uppdateras automatiskt.");
				// Trigger a config reload by refreshing the page after a short delay
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error saving settings:", error);
			setMessage("Could not save settings");
		}
		setSaving(false);
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-6 shadow">
			<h2 className="text-xl font-bold mb-4">Settings</h2>

			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Language
					</label>
					<select
						value={language}
						onChange={(e) => setLanguage(e.target.value)}
						className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="sv">Svenska</option>
						<option value="en">English</option>
						<option value="sr">Српски (Serbian)</option>
						<option value="es">Español</option>
						<option value="de">Deutsch</option>
					</select>
					<p className="text-sm text-slate-500 mt-1">
						Select which language to use in the entire application
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Color Theme
					</label>
					<select
						value={theme}
						onChange={(e) => setTheme(e.target.value)}
						className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="default">
							Blue/Yellow - Sweden, English (Default)
						</option>
						<option value="green">Green - Germany, Activism</option>
						<option value="red">Red/Gold - Spain, Serbia</option>
					</select>
					<p className="text-sm text-slate-500 mt-1">
						Recommendations: Swedish/English→Blue, German→Green,
						Spanish/Serbian→Red
					</p>
				</div>

				{isSuperAdmin && (
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Session Time Limit (hours)
						</label>
						<input
							type="number"
							min="1"
							max="168"
							value={sessionLimitHours}
							onChange={(e) =>
								setSessionLimitHours(e.target.value)
							}
							className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="24"
						/>
						<p className="text-sm text-slate-500 mt-1">
							Sessions automatically close when everyone has voted
							or after this time limit (1-168 hours from session start)
						</p>
					</div>
				)}

				<button
					onClick={handleSave}
					disabled={saving}
					className="px-6 py-2 bg-accent-500 text-slate-900 rounded-lg hover:bg-accent-600 font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed"
				>
					{saving ? "Saving..." : "Save settings"}
				</button>

				{message && (
					<div
						className={`p-3 rounded-lg ${
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
	);
}

function UsersPanel() {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [editing, setEditing] = useState(null);
	const [form, setForm] = useState({
		name: "",
		email: "",
		isAdmin: false,
		isSuperAdmin: false,
		remainingSessions: 0,
		sessionLimit: 10,
	});

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/users");
			if (res.ok) {
				const data = await res.json();
				setItems(Array.isArray(data) ? data : []);
			} else {
				console.error("Error loading users:", res.status);
				setItems([]);
			}
		} catch (error) {
			console.error("Error loading users:", error);
			setItems([]);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		load();
	}, [load]);

	const startEdit = (u) => {
		setEditing(u.id);
		setForm({
			name: u.name,
			email: u.email,
			isAdmin: !!u.isAdmin,
			isSuperAdmin: !!u.isSuperAdmin,
			remainingSessions: u.remainingSessions || 0,
			sessionLimit: u.sessionLimit || 10,
		});
	};
	const cancel = () => {
		setEditing(null);
	};
	const save = async () => {
		await fetchWithCsrf("/api/admin/users", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: editing, updates: form }),
		});
		setEditing(null);
		load();
	};
	const remove = async (id) => {
		if (!confirm("Delete user? Related data will be deleted.")) return;
		await fetchWithCsrf(`/api/admin/users?id=${id}`, { method: "DELETE" });
		load();
	};

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
			<h2 className="text-xl font-bold mb-4">Users</h2>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-left text-slate-500 border-b">
							<th className="pb-2">Name</th>
							<th className="pb-2">Email</th>
							<th className="pb-2">Role</th>
							<th className="pb-2">Sessions</th>
							<th className="pb-2">Created</th>
							<th className="pb-2"></th>
						</tr>
					</thead>
					<tbody>
						{items.map((u) => (
							<tr key={u.id} className="border-t">
								<td className="py-3">
									{editing === u.id ? (
										<input
											className="border rounded px-2 py-1 w-full"
											value={form.name}
											onChange={(e) =>
												setForm((f) => ({
													...f,
													name: e.target.value,
												}))
											}
										/>
									) : (
										<div>
											<div className="font-medium">
												{u.name}
											</div>
											{u.organization && (
												<div className="text-xs text-slate-500">
													{u.organization}
												</div>
											)}
										</div>
									)}
								</td>
								<td className="py-3">
									{editing === u.id ? (
										<input
											className="border rounded px-2 py-1 w-full"
											value={form.email}
											onChange={(e) =>
												setForm((f) => ({
													...f,
													email: e.target.value,
												}))
											}
										/>
									) : (
										u.email
									)}
								</td>
								<td className="py-3">
									{editing === u.id ? (
										<div className="space-y-2">
											<label className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={form.isSuperAdmin}
													onChange={(e) =>
														setForm((f) => ({
															...f,
															isSuperAdmin:
																e.target
																	.checked,
															isAdmin: e.target
																.checked
																? true
																: f.isAdmin,
														}))
													}
												/>
												<span className="text-xs">
													Super Admin
												</span>
											</label>
											<label className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={form.isAdmin}
													disabled={form.isSuperAdmin}
													onChange={(e) =>
														setForm((f) => ({
															...f,
															isAdmin:
																e.target
																	.checked,
														}))
													}
												/>
												<span className="text-xs">
													Admin
												</span>
											</label>
										</div>
									) : (
										<div>
											{u.isSuperAdmin ? (
												<span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
													Super Admin
												</span>
											) : u.isAdmin ? (
												<span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
													Admin
												</span>
											) : (
												<span className="text-slate-400">
													User
												</span>
											)}
										</div>
									)}
								</td>
								<td className="py-3">
									{editing === u.id ? (
										<div className="space-y-1">
											<div className="flex items-center gap-1">
												<label className="text-xs text-slate-600">
													Remaining:
												</label>
												<input
													type="number"
													min="0"
													max="50"
													className="border rounded px-2 py-1 w-16 text-xs"
													value={
														form.remainingSessions
													}
													onChange={(e) =>
														setForm((f) => ({
															...f,
															remainingSessions:
																parseInt(
																	e.target
																		.value
																) || 0,
														}))
													}
												/>
											</div>
											<div className="flex items-center gap-1">
												<label className="text-xs text-slate-600">
													Limit:
												</label>
												<input
													type="number"
													min="1"
													max="50"
													className="border rounded px-2 py-1 w-16 text-xs"
													value={form.sessionLimit}
													onChange={(e) =>
														setForm((f) => ({
															...f,
															sessionLimit:
																parseInt(
																	e.target
																		.value
																) || 10,
														}))
													}
												/>
											</div>
										</div>
									) : (
										<div className="text-xs">
											{u.isAdmin && !u.isSuperAdmin ? (
												<>
													<div>
														<span className="text-slate-600">
															Remaining:
														</span>{" "}
														<span className="font-medium">
															{u.remainingSessions ||
																0}
														</span>
													</div>
													<div>
														<span className="text-slate-600">
															Limit:
														</span>{" "}
														<span className="font-medium">
															{u.sessionLimit ||
																10}
														</span>
													</div>
												</>
											) : u.isSuperAdmin ? (
												<span className="text-slate-400">
													Unlimited
												</span>
											) : (
												<span className="text-slate-400">
													–
												</span>
											)}
										</div>
									)}
								</td>
								<td className="py-3 text-xs text-slate-500">
									{new Date(u.createdAt).toLocaleDateString(
										"sv-SE"
									)}
								</td>
								<td className="py-3 text-right">
									{editing === u.id ? (
										<div className="flex gap-2 justify-end">
											<button
												onClick={save}
												className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700"
											>
												Save
											</button>
											<button
												onClick={cancel}
												className="px-3 py-1 rounded bg-slate-200 text-xs font-medium hover:bg-slate-300"
											>
												Cancel
											</button>
										</div>
									) : (
										<div className="flex gap-2 justify-end">
											<button
												onClick={() => startEdit(u)}
												className="px-3 py-1 rounded bg-slate-200 text-xs font-medium hover:bg-slate-300"
											>
												Edit
											</button>
											<button
												onClick={() => remove(u.id)}
												className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700"
											>
												Delete
											</button>
										</div>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

function SessionsPanel({ t }) {
	const router = useRouter();

	return (
		<section className="bg-white rounded-xl p-6 shadow">
			<div className="text-center py-12">
				<h2 className="text-2xl font-bold mb-4 text-slate-800">
					{t("admin.sessionManagement") || "Session Management"}
				</h2>
				<p className="text-slate-600 mb-6 max-w-md mx-auto">
					{t("admin.sessionsMovedMessage") || "Session management has been moved to a dedicated page for better organization and accessibility."}
				</p>
				<button
					onClick={() => router.push("/manage-sessions")}
					className="px-6 py-3 bg-accent-500 text-slate-900 rounded-lg hover:bg-accent-600 font-semibold shadow-md hover:shadow-lg transition-all"
				>
					{t("admin.goToManageSessions") || "Go to Manage Sessions"}
				</button>
			</div>
		</section>
	);
}

function TopProposalsPanel() {
	const [topProposals, setTopProposals] = useState([]);
	const [loading, setLoading] = useState(true);

	const loadTopProposals = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/top-proposals");
			if (res.ok) {
				const data = await res.json();
				setTopProposals(Array.isArray(data) ? data : []);
			} else {
				console.error("Error loading top proposals:", res.status);
				setTopProposals([]);
			}
		} catch (error) {
			console.error("Error loading top proposals:", error);
			setTopProposals([]);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadTopProposals();
	}, [loadTopProposals]);

	if (loading) return <div className="p-4 bg-white rounded-xl">Loading…</div>;

	return (
		<section className="bg-white rounded-xl p-6 shadow">
			<h2 className="text-xl font-bold mb-4">
				Top Proposals from All Sessions
			</h2>

			{topProposals.length > 0 ? (
				<div className="space-y-4">
					{topProposals.map((tp) => (
						<div
							key={tp.id}
							className="p-4 border-l-4 border-accent-400 bg-accent-50 rounded-lg"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<h3 className="font-bold text-lg text-primary-900">
											{tp.title}
										</h3>
									</div>

									<div className="space-y-2 text-sm mb-3">
										<div>
											<span className="font-semibold text-slate-700">
												Problem:
											</span>
											<p className="text-slate-600">
												{tp.problem}
											</p>
										</div>
										<div>
											<span className="font-semibold text-slate-700">
												Solution:
											</span>
											<p className="text-slate-600">
												{tp.solution}
											</p>
										</div>
									</div>

									<div className="flex items-center gap-4 text-sm">
										<span className="text-slate-600">
											<strong>{tp.sessionPlace}</strong> •{" "}
											{new Date(
												tp.sessionStartDate
											).toLocaleDateString("sv-SE")}
										</span>
										<span className="text-green-700">
											👍 {tp.yesVotes} yes
										</span>
										<span className="text-red-700">
											👎 {tp.noVotes} no
										</span>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<p className="text-slate-600">No top proposals yet</p>
			)}
		</section>
	);
}

function EmailPanel() {
	const [sessions, setSessions] = useState([]);
	const [selectedSession, setSelectedSession] = useState("");
	const [broadcastSubject, setBroadcastSubject] = useState("");
	const [broadcastMessage, setBroadcastMessage] = useState("");
	const [sending, setSending] = useState(false);
	const [message, setMessage] = useState("");

	const loadSessions = useCallback(async () => {
		try {
			const res = await fetch("/api/admin/sessions");
			if (res.ok) {
				const data = await res.json();
				setSessions(
					Array.isArray(data)
						? data.filter((s) => s.status === "closed")
						: []
				);
			} else {
				console.error("Error loading sessions:", res.status);
				setSessions([]);
			}
		} catch (error) {
			console.error("Error loading sessions:", error);
			setSessions([]);
		}
	}, []);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadSessions();
	}, [loadSessions]);

	const sendResultsEmail = async () => {
		if (!selectedSession) {
			setMessage("Select a session");
			return;
		}

		if (
			!confirm(
				"Are you sure you want to send results email to all participants in this session?"
			)
		) {
			return;
		}

		setSending(true);
		setMessage("");

		try {
			const res = await fetchWithCsrf("/api/admin/send-results-email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId: selectedSession }),
			});

			if (res.ok) {
				const data = await res.json();
				setMessage(
					`Email sent to ${data.successCount} users! (${data.errorCount} failed)`
				);
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error sending results email:", error);
			setMessage("Could not send email");
		}

		setSending(false);
	};

	const sendBroadcastEmail = async () => {
		if (!broadcastSubject || !broadcastMessage) {
			setMessage("Subject and message required");
			return;
		}

		if (
			!confirm("Are you sure you want to send this email to ALL users?")
		) {
			return;
		}

		setSending(true);
		setMessage("");

		try {
			const res = await fetchWithCsrf("/api/admin/send-broadcast-email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					subject: broadcastSubject,
					message: broadcastMessage,
				}),
			});

			if (res.ok) {
				const data = await res.json();
				setMessage(
					`Email sent to ${data.successCount} users! (${data.errorCount} failed)`
				);
				setBroadcastSubject("");
				setBroadcastMessage("");
			} else {
				const error = await res.json();
				setMessage(`Error: ${error.error}`);
			}
		} catch (error) {
			console.error("Error sending broadcast email:", error);
			setMessage("Could not send email");
		}

		setSending(false);
	};

	return (
		<section className="bg-white rounded-xl p-6 shadow space-y-6">
			<div>
				<h2 className="text-xl font-bold mb-4">Send Results Email</h2>
				<p className="text-sm text-slate-600 mb-4">
					Send an email to all participants in a closed session with
					information about which proposals won.
				</p>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Select Session
						</label>
						<select
							value={selectedSession}
							onChange={(e) => setSelectedSession(e.target.value)}
							className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2"
						>
							<option value="">-- Select session --</option>
							{sessions.map((s) => (
								<option key={s._id} value={s._id}>
									{s.place} -{" "}
									{new Date(s.startDate).toLocaleDateString()}
								</option>
							))}
						</select>
					</div>

					<button
						onClick={sendResultsEmail}
						disabled={sending || !selectedSession}
						className="px-6 py-2 bg-accent-500 text-slate-900 rounded-lg hover:bg-accent-600 font-semibold disabled:bg-slate-400"
					>
						{sending ? "Sending..." : "Send results email"}
					</button>
				</div>
			</div>

			<hr className="my-6" />

			<div>
				<h2 className="text-xl font-bold mb-4">Send Broadcast Email</h2>
				<p className="text-sm text-slate-600 mb-4">
					Send an email to ALL users in the system.
				</p>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Subject
						</label>
						<input
							type="text"
							value={broadcastSubject}
							onChange={(e) =>
								setBroadcastSubject(e.target.value)
							}
							className="w-full border border-slate-300 rounded-lg px-4 py-2"
							placeholder="e.g. Important information"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-2">
							Message
						</label>
						<textarea
							value={broadcastMessage}
							onChange={(e) =>
								setBroadcastMessage(e.target.value)
							}
							className="w-full border border-slate-300 rounded-lg px-4 py-2 h-40"
							placeholder="Your message..."
						/>
					</div>

					<button
						onClick={sendBroadcastEmail}
						disabled={
							sending || !broadcastSubject || !broadcastMessage
						}
						className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-400"
					>
						{sending ? "Sending..." : "Send to all users"}
					</button>
				</div>
			</div>

			{message && (
				<div
					className={`p-3 rounded-lg ${
						message.startsWith("Error")
							? "bg-red-100 text-red-700"
							: "bg-green-100 text-green-700"
					}`}
				>
					{message}
				</div>
			)}
		</section>
	);
}

function AdminApplicationsPanel() {
	const [applications, setApplications] = useState([]);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState("");

	useEffect(() => {
		fetchApplications();
	}, []);

	const fetchApplications = async () => {
		try {
			const res = await fetch("/api/admin/admin-applications");
			if (res.ok) {
				const data = await res.json();
				setApplications(data.applications || []);
			}
		} catch (error) {
			console.error("Error fetching applications:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleApplication = async (userId, action, sessionLimit = 10) => {
		try {
			const res = await fetchWithCsrf("/api/admin/admin-applications", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId, action, sessionLimit }),
			});

			if (res.ok) {
				setMessage(`Application ${action}ed successfully`);
				// Refresh the list
				await fetchApplications();
				setTimeout(() => setMessage(""), 3000);
			} else {
				const data = await res.json();
				setMessage(`Error: ${data.message}`);
			}
		} catch (error) {
			console.error("Error processing application:", error);
			setMessage("Error processing application");
		}
	};

	if (loading) {
		return <div className="p-4">Loading...</div>;
	}

	return (
		<section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
			<h2 className="text-xl font-bold mb-4">Admin Applications</h2>

			{message && (
				<div
					className={`mb-4 p-3 rounded-lg ${
						message.startsWith("Error")
							? "bg-red-100 text-red-700"
							: "bg-green-100 text-green-700"
					}`}
				>
					{message}
				</div>
			)}

			{applications.length === 0 ? (
				<p className="text-slate-600">No pending applications</p>
			) : (
				<div className="space-y-4">
					{applications.map((app) => (
						<ApplicationCard
							key={app._id}
							application={app}
							onApprove={(sessionLimit) =>
								handleApplication(
									app._id,
									"approve",
									sessionLimit
								)
							}
							onDeny={() => handleApplication(app._id, "deny")}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function ApplicationCard({ application, onApprove, onDeny }) {
	const [sessionLimit, setSessionLimit] = useState(
		application.requestedSessions || 10
	);
	const [showLimitInput, setShowLimitInput] = useState(false);

	return (
		<div className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
			<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
				<div className="flex-1">
					<h3 className="font-semibold text-lg">
						{application.name}
					</h3>
					<p className="text-sm text-slate-600">
						{application.email}
					</p>
					{application.organization && (
						<p className="text-sm text-slate-700 mt-1">
							<span className="font-medium">Organization:</span>{" "}
							{application.organization}
						</p>
					)}
					<p className="text-sm text-slate-700 mt-1">
						<span className="font-medium">Requested sessions:</span>{" "}
						{application.requestedSessions || 10}
					</p>
					<p className="text-xs text-slate-500 mt-1">
						Applied:{" "}
						{new Date(
							application.appliedForAdminAt
						).toLocaleDateString()}
					</p>
				</div>

				<div className="flex flex-col sm:flex-row gap-2">
					{!showLimitInput ? (
						<>
							<button
								onClick={() => setShowLimitInput(true)}
								className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
							>
								Approve
							</button>
							<button
								onClick={onDeny}
								className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
							>
								Deny
							</button>
						</>
					) : (
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium whitespace-nowrap">
									Session limit:
								</label>
								<input
									type="number"
									min="1"
									max="50"
									value={sessionLimit}
									onChange={(e) =>
										setSessionLimit(
											parseInt(e.target.value) || 10
										)
									}
									className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
								/>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => onApprove(sessionLimit)}
									className="flex-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
								>
									Confirm
								</button>
								<button
									onClick={() => setShowLimitInput(false)}
									className="flex-1 px-3 py-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 text-sm"
								>
									Cancel
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function SessionRequestsPanel() {
	const [requests, setRequests] = useState([]);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState("");

	useEffect(() => {
		fetchRequests();
	}, []);

	const fetchRequests = async () => {
		try {
			const res = await fetch("/api/admin/session-requests");
			if (res.ok) {
				const data = await res.json();
				setRequests(data.requests || []);
			}
		} catch (error) {
			console.error("Error fetching session requests:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleRequest = async (requestId, action, grantedSessions = null) => {
		try {
			const res = await fetchWithCsrf("/api/admin/session-requests", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ requestId, action, grantedSessions }),
			});

			if (res.ok) {
				const data = await res.json();
				setMessage(data.message);
				// Refresh the list
				await fetchRequests();
				setTimeout(() => setMessage(""), 3000);
			} else {
				const data = await res.json();
				setMessage(`Error: ${data.message}`);
			}
		} catch (error) {
			console.error("Error processing request:", error);
			setMessage("Error processing request");
		}
	};

	if (loading) {
		return <div className="p-4">Loading...</div>;
	}

	return (
		<section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
			<h2 className="text-xl font-bold mb-4">Session Requests</h2>
			<p className="text-sm text-slate-600 mb-4">
				Existing admins requesting more sessions
			</p>

			{message && (
				<div
					className={`mb-4 p-3 rounded-lg ${
						message.startsWith("Error")
							? "bg-red-100 text-red-700"
							: "bg-green-100 text-green-700"
					}`}
				>
					{message}
				</div>
			)}

			{requests.length === 0 ? (
				<p className="text-slate-600">No pending session requests</p>
			) : (
				<div className="space-y-4">
					{requests.map((request) => (
						<SessionRequestCard
							key={request._id}
							request={request}
							onApprove={(grantedSessions) =>
								handleRequest(
									request._id,
									"approve",
									grantedSessions
								)
							}
							onDeny={() => handleRequest(request._id, "deny")}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function SessionRequestCard({ request, onApprove, onDeny }) {
	const [grantedSessions, setGrantedSessions] = useState(
		request.requestedSessions
	);
	const [showSessionInput, setShowSessionInput] = useState(false);

	return (
		<div className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
			<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
				<div className="flex-1">
					<h3 className="font-semibold text-lg">
						{request.userId.name}
					</h3>
					<p className="text-sm text-slate-600">
						{request.userId.email}
					</p>
					{request.userId.organization && (
						<p className="text-sm text-slate-700 mt-1">
							<span className="font-medium">Organization:</span>{" "}
							{request.userId.organization}
						</p>
					)}
					<p className="text-sm text-slate-700 mt-1">
						<span className="font-medium">
							Current remaining sessions:
						</span>{" "}
						{request.userId.remainingSessions}
					</p>
					<p className="text-sm text-slate-700 mt-1">
						<span className="font-medium">Requested sessions:</span>{" "}
						{request.requestedSessions}
					</p>
					<p className="text-xs text-slate-500 mt-1">
						Requested:{" "}
						{new Date(request.createdAt).toLocaleDateString()}
					</p>
				</div>

				<div className="flex flex-col sm:flex-row gap-2">
					{!showSessionInput ? (
						<>
							<button
								onClick={() => setShowSessionInput(true)}
								className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
							>
								Approve
							</button>
							<button
								onClick={onDeny}
								className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
							>
								Deny
							</button>
						</>
					) : (
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium whitespace-nowrap">
									Grant sessions:
								</label>
								<input
									type="number"
									min="1"
									max="50"
									value={grantedSessions}
									onChange={(e) =>
										setGrantedSessions(
											parseInt(e.target.value) || 1
										)
									}
									className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
								/>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => onApprove(grantedSessions)}
									className="flex-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
								>
									Confirm
								</button>
								<button
									onClick={() => setShowSessionInput(false)}
									className="flex-1 px-3 py-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 text-sm"
								>
									Cancel
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
