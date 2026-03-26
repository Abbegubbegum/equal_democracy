import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { ArrowLeft, ThumbsUp, Send, Pencil } from "lucide-react";
import { fetchWithCsrf } from "../../../lib/fetch-with-csrf";

export default function BudgetDebatePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { sessionId } = router.query;

	const [budgetSession, setBudgetSession] = useState(null);
	const [arguments_, setArguments] = useState([]);
	const [selectedCategoryId, setSelectedCategoryId] = useState(null);
	const [loading, setLoading] = useState(true);

	// Form state per direction
	const [upText, setUpText] = useState("");
	const [downText, setDownText] = useState("");
	const [submitting, setSubmitting] = useState(null); // "up" | "down" | null
	const [editingDirection, setEditingDirection] = useState(null); // "up" | "down" | null

	useEffect(() => {
		if (status === "unauthenticated") router.push("/login");
	}, [status, router]);

	const fetchBudgetSession = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch("/api/budget/sessions");
			const data = await res.json();
			const found = data.sessions?.find((s) => s.sessionId === sessionId);
			if (found) {
				setBudgetSession(found);
				setSelectedCategoryId(found.categories?.[0]?.id || null);
			}
		} catch {}
	}, [sessionId]);

	const fetchArguments = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch(`/api/budget/debate?sessionId=${sessionId}`);
			const data = await res.json();
			setArguments(data.arguments || []);
		} catch {}
		finally { setLoading(false); }
	}, [sessionId]);

	useEffect(() => {
		if (session && sessionId) {
			fetchBudgetSession();
			fetchArguments();
		}
	}, [session, sessionId, fetchBudgetSession, fetchArguments]);

	// When category changes, pre-fill form with user's existing arguments
	useEffect(() => {
		if (!selectedCategoryId) return;
		const myUp = arguments_.find(
			(a) => a.categoryId === selectedCategoryId && a.direction === "up" && a.isOwn
		);
		const myDown = arguments_.find(
			(a) => a.categoryId === selectedCategoryId && a.direction === "down" && a.isOwn
		);
		setUpText(myUp ? myUp.text : "");
		setDownText(myDown ? myDown.text : "");
		setEditingDirection(null);
	}, [selectedCategoryId, arguments_]);

	const selectedCategory = budgetSession?.categories?.find(
		(c) => c.id === selectedCategoryId
	);

	const categoryArguments = arguments_.filter(
		(a) => a.categoryId === selectedCategoryId
	);
	const upArgs = categoryArguments
		.filter((a) => a.direction === "up")
		.sort((a, b) => b.helpfulCount - a.helpfulCount);
	const downArgs = categoryArguments
		.filter((a) => a.direction === "down")
		.sort((a, b) => b.helpfulCount - a.helpfulCount);

	const myUpArg = upArgs.find((a) => a.isOwn);
	const myDownArg = downArgs.find((a) => a.isOwn);

	async function handleSubmit(direction) {
		const text = direction === "up" ? upText : downText;
		if (!text.trim() || !selectedCategory) return;
		setSubmitting(direction);
		try {
			const res = await fetchWithCsrf("/api/budget/debate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId,
					categoryId: selectedCategory.id,
					categoryName: selectedCategory.name,
					direction,
					text: text.trim(),
				}),
			});
			if (res.ok) {
				await fetchArguments();
				setEditingDirection(null);
			}
		} catch {}
		finally { setSubmitting(null); }
	}

	async function handleHelpful(argumentId) {
		try {
			const res = await fetchWithCsrf("/api/budget/debate/helpful", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ argumentId }),
			});
			if (res.ok) {
				const data = await res.json();
				setArguments((prev) =>
					prev.map((a) =>
						a._id === argumentId
							? { ...a, helpfulCount: data.helpfulCount, userFoundHelpful: data.userFoundHelpful }
							: a
					)
				);
			}
		} catch {}
	}

	async function handleHide(argumentId) {
		try {
			await fetchWithCsrf("/api/budget/debate", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ argumentId }),
			});
			setArguments((prev) => prev.filter((a) => a._id !== argumentId));
		} catch {}
	}

	if (status === "loading" || loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<p className="text-gray-500">Laddar...</p>
			</div>
		);
	}

	if (!session) return null;

	const isAdmin = session.user?.isAdmin || session.user?.isSuperAdmin;

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-emerald-700 text-white p-5 shadow">
				<div className="max-w-5xl mx-auto">
					<div className="flex items-center justify-between mb-3">
						<button
							onClick={() => router.push(`/budget/${sessionId}`)}
							className="flex items-center gap-2 text-emerald-100 hover:text-white transition-colors"
						>
							<ArrowLeft className="w-4 h-4" />
							Till omröstningen
						</button>
					</div>
					<h1 className="text-xl font-bold">
						Debatt — {budgetSession?.name}
					</h1>
					<p className="text-emerald-200 text-sm mt-1">
						Välj en kategori och bidra med ett strukturerat argument
					</p>
				</div>
			</header>

			{/* Category tabs */}
			<div className="bg-white border-b shadow-sm">
				<div className="max-w-5xl mx-auto px-4">
					<div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
						{budgetSession?.categories?.map((cat) => {
							const count = arguments_.filter((a) => a.categoryId === cat.id).length;
							return (
								<button
									key={cat.id}
									onClick={() => setSelectedCategoryId(cat.id)}
									className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
										selectedCategoryId === cat.id
											? "bg-emerald-700 text-white"
											: "bg-gray-100 text-gray-700 hover:bg-gray-200"
									}`}
								>
									{cat.name}
									{count > 0 && (
										<span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
											selectedCategoryId === cat.id
												? "bg-emerald-500 text-white"
												: "bg-gray-300 text-gray-600"
										}`}>
											{count}
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Debate columns */}
			<div className="max-w-5xl mx-auto p-4 sm:p-6">
				{selectedCategory ? (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

						{/* HOJ column */}
						<DebateColumn
							direction="up"
							label="Höj"
							labelColor="text-emerald-700"
							borderColor="border-emerald-200"
							headerBg="bg-emerald-50"
							badgeBg="bg-emerald-100"
							badgeText="text-emerald-800"
							category={selectedCategory}
							args={upArgs}
							myArg={myUpArg}
							text={upText}
							setText={setUpText}
							isEditing={editingDirection === "up"}
							setEditing={(v) => setEditingDirection(v ? "up" : null)}
							onSubmit={() => handleSubmit("up")}
							submitting={submitting === "up"}
							onHelpful={handleHelpful}
							onHide={isAdmin ? handleHide : null}
						/>

						{/* SANK column */}
						<DebateColumn
							direction="down"
							label="Sänk"
							labelColor="text-red-700"
							borderColor="border-red-200"
							headerBg="bg-red-50"
							badgeBg="bg-red-100"
							badgeText="text-red-800"
							category={selectedCategory}
							args={downArgs}
							myArg={myDownArg}
							text={downText}
							setText={setDownText}
							isEditing={editingDirection === "down"}
							setEditing={(v) => setEditingDirection(v ? "down" : null)}
							onSubmit={() => handleSubmit("down")}
							submitting={submitting === "down"}
							onHelpful={handleHelpful}
							onHide={isAdmin ? handleHide : null}
						/>
					</div>
				) : (
					<p className="text-gray-500 text-center py-12">Välj en kategori ovan.</p>
				)}
			</div>
		</div>
	);
}

function DebateColumn({
	direction, label, labelColor, borderColor, headerBg, badgeBg, badgeText,
	category, args, myArg,
	text, setText, isEditing, setEditing, onSubmit, submitting,
	onHelpful, onHide,
}) {
	const showForm = !myArg || isEditing;
	const arrowSymbol = direction === "up" ? "↑" : "↓";

	return (
		<div className={`border ${borderColor} rounded-xl overflow-hidden`}>
			{/* Column header */}
			<div className={`${headerBg} px-4 py-3 flex items-center gap-2`}>
				<span className={`text-lg font-bold ${labelColor}`}>{arrowSymbol}</span>
				<span className={`font-semibold ${labelColor}`}>
					{label} {category.name}
				</span>
				<span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${badgeBg} ${badgeText}`}>
					{args.length} argument
				</span>
			</div>

			<div className="p-4 space-y-3">
				{/* Argument form */}
				{showForm ? (
					<div className="space-y-2">
						<textarea
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder={`Varför bör ${category.name} ${direction === "up" ? "höjas" : "sänkas"}?`}
							rows={3}
							maxLength={400}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
						/>
						<div className="flex items-center justify-between">
							<span className="text-xs text-gray-400">{text.length}/400</span>
							<div className="flex gap-2">
								{myArg && (
									<button
										onClick={() => setEditing(false)}
										className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
									>
										Avbryt
									</button>
								)}
								<button
									onClick={onSubmit}
									disabled={submitting || !text.trim()}
									className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
								>
									<Send className="w-3.5 h-3.5" />
									{myArg ? "Uppdatera" : "Publicera"}
								</button>
							</div>
						</div>
					</div>
				) : (
					<button
						onClick={() => setEditing(true)}
						className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
					>
						<Pencil className="w-3.5 h-3.5" />
						Redigera ditt argument
					</button>
				)}

				{/* Argument cards */}
				{args.length === 0 && !showForm && (
					<p className="text-sm text-gray-400 text-center py-4">Inga argument än.</p>
				)}
				{args.map((arg) => (
					<ArgumentCard
						key={arg._id}
						arg={arg}
						onHelpful={onHelpful}
						onHide={onHide}
					/>
				))}
			</div>
		</div>
	);
}

function ArgumentCard({ arg, onHelpful, onHide }) {
	return (
		<div className={`bg-white border rounded-lg p-3 ${arg.isOwn ? "border-blue-200 bg-blue-50/30" : "border-gray-200"}`}>
			<div className="flex items-start justify-between gap-2 mb-2">
				{arg.isOwn && <span className="text-xs font-semibold text-blue-500">(ditt argument)</span>}
				<span className="text-xs text-gray-400 shrink-0 ml-auto">
					{new Date(arg.createdAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
				</span>
			</div>
			<p className="text-sm text-gray-800 leading-relaxed mb-3">{arg.text}</p>
			<div className="flex items-center justify-between">
				<button
					onClick={() => !arg.isOwn && onHelpful(arg._id)}
					disabled={arg.isOwn}
					title={arg.isOwn ? "Du kan inte markera ditt eget argument" : "Bra argument"}
					className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors ${
						arg.isOwn
							? "text-gray-300 cursor-not-allowed"
							: arg.userFoundHelpful
								? "bg-emerald-100 text-emerald-700 font-medium"
								: "text-gray-500 hover:bg-gray-100"
					}`}
				>
					<ThumbsUp className="w-3.5 h-3.5" />
					Bra argument
					{arg.helpfulCount > 0 && (
						<span className="ml-0.5 font-semibold">{arg.helpfulCount}</span>
					)}
				</button>
				{onHide && (
					<button
						onClick={() => onHide(arg._id)}
						className="text-xs text-red-400 hover:text-red-600"
					>
						Dölj
					</button>
				)}
			</div>
		</div>
	);
}
