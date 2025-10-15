import React, { useState, useEffect } from "react";
import {
	ThumbsUp,
	MessageCircle,
	CheckCircle,
	Plus,
	Users,
	TrendingUp,
	Info,
} from "lucide-react";

// ============================================================================
// CORE CLASSES (Object-Oriented Architecture)
// ============================================================================

class User {
	constructor(id, name, createdAt = new Date()) {
		this.id = id;
		this.name = name;
		this.createdAt = createdAt;
	}
}

class Proposal {
	constructor(id, title, description, authorId, authorName) {
		this.id = id;
		this.title = title;
		this.description = description;
		this.authorId = authorId;
		this.authorName = authorName;
		this.thumbsUp = 0;
		this.votedBy = new Set();
		this.comments = [];
		this.createdAt = new Date();
		this.status = "active";
	}

	addThumbsUp(userId) {
		if (!this.votedBy.has(userId)) {
			this.thumbsUp++;
			this.votedBy.add(userId);
			return true;
		}
		return false;
	}

	addComment(comment) {
		this.comments.push(comment);
	}
}

class Comment {
	constructor(id, proposalId, authorId, authorName, text) {
		this.id = id;
		this.proposalId = proposalId;
		this.authorId = authorId;
		this.authorName = authorName;
		this.text = text;
		this.createdAt = new Date();
	}
}

class Vote {
	constructor(id, proposalId, userId, choice) {
		this.id = id;
		this.proposalId = proposalId;
		this.userId = userId;
		this.choice = choice;
		this.createdAt = new Date();
	}
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function EqualDemocracyApp() {
	const [currentUser, setCurrentUser] = useState(null);
	const [view, setView] = useState("welcome");
	const [proposals, setProposals] = useState([]);
	const [selectedProposal, setSelectedProposal] = useState(null);
	const [finalVotes, setFinalVotes] = useState([]);

	// Load data from localStorage on mount
	useEffect(() => {
		const savedUser = localStorage.getItem("ed_user");
		const savedProposals = localStorage.getItem("ed_proposals");
		const savedVotes = localStorage.getItem("ed_votes");

		if (savedUser) {
			setCurrentUser(JSON.parse(savedUser));
		}

		if (savedProposals) {
			const parsed = JSON.parse(savedProposals);
			setProposals(
				parsed.map((p) => {
					const proposal = Object.assign(new Proposal(), p);
					proposal.votedBy = new Set(p.votedBy);
					return proposal;
				})
			);
		}

		if (savedVotes) {
			setFinalVotes(JSON.parse(savedVotes));
		}
	}, []);

	// Save user to localStorage
	useEffect(() => {
		if (currentUser) {
			localStorage.setItem("ed_user", JSON.stringify(currentUser));
		}
	}, [currentUser]);

	// Save proposals to localStorage
	useEffect(() => {
		if (proposals.length > 0) {
			const serialized = proposals.map((p) => ({
				...p,
				votedBy: Array.from(p.votedBy),
			}));
			localStorage.setItem("ed_proposals", JSON.stringify(serialized));
		}
	}, [proposals]);

	// Save votes to localStorage
	useEffect(() => {
		if (finalVotes.length > 0) {
			localStorage.setItem("ed_votes", JSON.stringify(finalVotes));
		}
	}, [finalVotes]);

	// Handler: Create new user
	const handleCreateUser = (name) => {
		const user = new User(Date.now().toString(), name);
		setCurrentUser(user);
		setView("home");
	};

	// Handler: Create new proposal
	const handleCreateProposal = (title, description) => {
		if (!currentUser) {
			return;
		}
		const proposal = new Proposal(
			Date.now().toString(),
			title,
			description,
			currentUser.id,
			currentUser.name
		);
		setProposals([...proposals, proposal]);
		setView("home");
	};

	// Handler: Add thumbs up to proposal
	const handleThumbsUp = (proposalId) => {
		if (!currentUser) {
			return;
		}
		setProposals(
			proposals.map((p) => {
				if (p.id === proposalId) {
					const newP = Object.assign(new Proposal(), p);
					newP.addThumbsUp(currentUser.id);
					return newP;
				}
				return p;
			})
		);
	};

	// Handler: Add comment to proposal
	const handleAddComment = (proposalId, text) => {
		if (!currentUser) {
			return;
		}
		const comment = new Comment(
			Date.now().toString(),
			proposalId,
			currentUser.id,
			currentUser.name,
			text
		);
		setProposals(
			proposals.map((p) => {
				if (p.id === proposalId) {
					const newP = { ...p };
					newP.comments = [...p.comments, comment];
					return newP;
				}
				return p;
			})
		);
	};

	// Handler: Move top 3 proposals to voting phase
	const handleMoveToTop3 = () => {
		const sorted = [...proposals].sort((a, b) => b.thumbsUp - a.thumbsUp);
		const top3 = sorted.slice(0, 3);
		setProposals(
			proposals.map((p) => ({
				...p,
				status: top3.find((t) => t.id === p.id) ? "top3" : p.status,
			}))
		);
	};

	// Handler: Cast final vote
	const handleFinalVote = (proposalId, choice) => {
		if (!currentUser) {
			return;
		}
		const vote = new Vote(
			Date.now().toString(),
			proposalId,
			currentUser.id,
			choice
		);
		setFinalVotes([...finalVotes, vote]);
	};

	// Get top 3 proposals
	const getTop3 = () => {
		return proposals
			.filter((p) => p.status === "top3")
			.sort((a, b) => b.thumbsUp - a.thumbsUp);
	};

	// Get vote results for a proposal
	const getVoteResults = (proposalId) => {
		const votes = finalVotes.filter((v) => v.proposalId === proposalId);
		const yes = votes.filter((v) => v.choice === "yes").length;
		const no = votes.filter((v) => v.choice === "no").length;
		return { yes, no, total: votes.length };
	};

	// Check if current user has voted on a proposal
	const hasVoted = (proposalId) => {
		return finalVotes.some(
			(v) => v.proposalId === proposalId && v.userId === currentUser.id
		);
	};

	// Render views based on current state
	if (view === "welcome" && !currentUser) {
		return (
			<WelcomeView
				onCreateUser={handleCreateUser}
				onAbout={() => setView("about")}
			/>
		);
	}

	if (view === "about") {
		return (
			<AboutView
				onBack={() => setView(currentUser ? "home" : "welcome")}
			/>
		);
	}

	if (view === "home") {
		return (
			<HomeView
				proposals={proposals}
				currentUser={currentUser}
				onCreateProposal={() => setView("create")}
				onThumbsUp={handleThumbsUp}
				onDiscuss={(p) => {
					setSelectedProposal(p);
					setView("discuss");
				}}
				onMoveToTop3={handleMoveToTop3}
				onVote={() => setView("vote")}
				onAbout={() => setView("about")}
			/>
		);
	}

	if (view === "create") {
		return (
			<CreateProposalView
				onSubmit={handleCreateProposal}
				onBack={() => setView("home")}
			/>
		);
	}

	if (view === "discuss" && selectedProposal) {
		return (
			<DiscussView
				proposal={proposals.find((p) => p.id === selectedProposal.id)}
				currentUser={currentUser}
				onAddComment={handleAddComment}
				onBack={() => setView("home")}
			/>
		);
	}

	if (view === "vote") {
		return (
			<VoteView
				proposals={getTop3()}
				currentUser={currentUser}
				onVote={handleFinalVote}
				hasVoted={hasVoted}
				getVoteResults={getVoteResults}
				onBack={() => setView("home")}
			/>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
			Laddar...
		</div>
	);
}

// ============================================================================
// WELCOME VIEW - Initial user creation screen
// ============================================================================

function WelcomeView({ onCreateUser, onAbout }) {
	const [name, setName] = useState("");

	const handleSubmit = (e) => {
		e.preventDefault();
		if (name.trim()) {
			onCreateUser(name.trim());
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-6">
			<div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6">
				<div className="text-center space-y-2">
					<div className="w-20 h-20 bg-yellow-400 rounded-full mx-auto flex items-center justify-center">
						<Users className="w-10 h-10 text-blue-800" />
					</div>
					<h1 className="text-3xl font-bold text-blue-800">
						Equal Democracy
					</h1>
					<p className="text-lg text-gray-600">
						Demokrati i din stad
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Vad heter du?
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
							placeholder="Ditt namn"
							autoFocus
						/>
					</div>
					<button
						type="submit"
						disabled={!name.trim()}
						className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg"
					>
						Kom igång
					</button>
				</form>

				<button
					onClick={onAbout}
					className="w-full text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2"
				>
					<Info className="w-4 h-4" />
					Om Equal Democracy
				</button>
			</div>
		</div>
	);
}

// ============================================================================
// ABOUT VIEW - Information about the app
// ============================================================================

function AboutView({ onBack }) {
	return (
		<div className="min-h-screen bg-gray-50 p-6">
			<div className="max-w-2xl mx-auto">
				<button
					onClick={onBack}
					className="mb-6 text-blue-600 hover:text-blue-700 font-medium"
				>
					← Tillbaka
				</button>

				<div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
					<div className="text-center">
						<div className="w-16 h-16 bg-yellow-400 rounded-full mx-auto flex items-center justify-center mb-4">
							<Users className="w-8 h-8 text-blue-800" />
						</div>
						<h1 className="text-3xl font-bold text-blue-800 mb-2">
							Equal Democracy
						</h1>
						<p className="text-gray-600">Version 1.0 - MVP</p>
					</div>

					<div className="space-y-4 text-gray-700">
						<h2 className="text-xl font-semibold text-blue-800">
							Vad är Equal Democracy?
						</h2>
						<p>
							Equal Democracy är en app för demokratiskt
							beslutsfattande som ger alla medborgare möjlighet
							att delta i viktiga beslut som påverkar deras stad
							och samhälle.
						</p>

						<h3 className="text-lg font-semibold text-blue-800 mt-6">
							Hur fungerar det?
						</h3>
						<ol className="list-decimal list-inside space-y-2 ml-2">
							<li>
								<strong>Föreslå idéer</strong> - Dela dina
								förslag för att förbättra staden
							</li>
							<li>
								<strong>Rösta med tummen upp</strong> - Stöd de
								idéer du gillar
							</li>
							<li>
								<strong>Diskutera topp 3</strong> - Förfina de
								mest populära förslagen tillsammans
							</li>
							<li>
								<strong>Rösta slutgiltigt</strong> - Bestäm
								vilka idéer som ska förverkligas
							</li>
						</ol>

						<h3 className="text-lg font-semibold text-blue-800 mt-6">
							Designprinciper
						</h3>
						<p>
							Appen är designad med svenska värderingar i åtanke -
							enkel, inkluderande och svår att misslyckas med.
							Inspirerad av IKEA:s demokratiska design.
						</p>

						<h3 className="text-lg font-semibold text-blue-800 mt-6">
							Framtidsvisionen
						</h3>
						<p>
							Detta är en MVP (Minimal Viable Product) för att
							testa konceptet lokalt inför valet i september 2026.
							Om Equal Democracy visar sig användbart kan systemet
							skalas upp med fler moduler och till slut kanske bli
							en del av en global demokratisk infrastruktur - ett
							"Global Citizen Council" där alla världens
							medborgare kan delta i viktiga beslut.
						</p>

						<div className="bg-blue-50 rounded-xl p-4 mt-6">
							<p className="text-sm text-blue-800">
								<strong>Offline-först:</strong> Appen fungerar
								utan internetuppkoppling och synkar när du är
								online igen.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// HOME VIEW - Main screen showing all proposals
// ============================================================================

function HomeView({
	proposals,
	currentUser,
	onCreateProposal,
	onThumbsUp,
	onDiscuss,
	onMoveToTop3,
	onVote,
	onAbout,
}) {
	const activeProposals = proposals
		.filter((p) => p.status === "active")
		.sort((a, b) => b.thumbsUp - a.thumbsUp);
	const top3Proposals = proposals.filter((p) => p.status === "top3");

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
				<div className="max-w-4xl mx-auto">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
								<Users className="w-6 h-6 text-blue-800" />
							</div>
							<div>
								<h1 className="text-2xl font-bold">
									Equal Democracy
								</h1>
								<p className="text-blue-100 text-sm">
									Hej, {currentUser.name}!
								</p>
							</div>
						</div>
						<button
							onClick={onAbout}
							className="text-white hover:text-yellow-400"
						>
							<Info className="w-6 h-6" />
						</button>
					</div>
					<h2 className="text-xl font-medium">
						Hur vill du förbättra vår stad?
					</h2>
				</div>
			</div>

			<div className="max-w-4xl mx-auto p-6 space-y-6">
				<button
					onClick={onCreateProposal}
					className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-800 font-bold py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105"
				>
					<Plus className="w-6 h-6" />
					Föreslå en ny idé
				</button>

				{top3Proposals.length > 0 && (
					<div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<TrendingUp className="w-6 h-6 text-yellow-600" />
								<h3 className="text-xl font-bold text-blue-800">
									Topp 3 förslag
								</h3>
							</div>
							<button
								onClick={onVote}
								className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
							>
								Rösta nu
							</button>
						</div>
						<p className="text-gray-700">
							Diskutera och rösta på de mest populära idéerna
						</p>
					</div>
				)}

				{activeProposals.length >= 3 && top3Proposals.length === 0 && (
					<button
						onClick={onMoveToTop3}
						className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg"
					>
						Lås topp 3 och börja diskutera
					</button>
				)}

				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
						<MessageCircle className="w-5 h-5" />
						Alla förslag ({activeProposals.length})
					</h3>
					{activeProposals.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>
								Inga förslag än. Var den första att föreslå
								något!
							</p>
						</div>
					) : (
						activeProposals.map((proposal) => (
							<ProposalCard
								key={proposal.id}
								proposal={proposal}
								currentUser={currentUser}
								onThumbsUp={onThumbsUp}
								onDiscuss={onDiscuss}
							/>
						))
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// PROPOSAL CARD - Individual proposal display
// ============================================================================

function ProposalCard({ proposal, currentUser, onThumbsUp, onDiscuss }) {
	const hasVoted = proposal.votedBy.has(currentUser.id);

	return (
		<div className="bg-white rounded-2xl shadow-md p-6 space-y-4 hover:shadow-lg transition-shadow">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<h4 className="text-lg font-bold text-blue-800 mb-2">
						{proposal.title}
					</h4>
					<p className="text-gray-600">{proposal.description}</p>
					<p className="text-sm text-gray-400 mt-2">
						Av {proposal.authorName}
					</p>
				</div>
			</div>

			<div className="flex items-center gap-3">
				<button
					onClick={() => onThumbsUp(proposal.id)}
					disabled={hasVoted}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
						hasVoted
							? "bg-blue-100 text-blue-600 cursor-not-allowed"
							: "bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600"
					}`}
				>
					<ThumbsUp className="w-5 h-5" />
					<span className="font-bold">{proposal.thumbsUp}</span>
				</button>

				<button
					onClick={() => onDiscuss(proposal)}
					className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
				>
					<MessageCircle className="w-5 h-5" />
					{proposal.comments.length}
				</button>
			</div>
		</div>
	);
}

// ============================================================================
// CREATE PROPOSAL VIEW - Form to submit new proposals
// ============================================================================

function CreateProposalView({ onSubmit, onBack }) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");

	const handleSubmit = (e) => {
		e.preventDefault();
		if (title.trim() && description.trim()) {
			onSubmit(title.trim(), description.trim());
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 p-6">
			<div className="max-w-2xl mx-auto">
				<button
					onClick={onBack}
					className="mb-6 text-blue-600 hover:text-blue-700 font-medium"
				>
					← Tillbaka
				</button>

				<div className="bg-white rounded-2xl shadow-lg p-8">
					<h2 className="text-2xl font-bold text-blue-800 mb-6">
						Föreslå en ny idé
					</h2>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Rubrik
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
								placeholder="T.ex. 'Fler cykelbanor i centrum'"
								autoFocus
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Beskrivning
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={6}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
								placeholder="Beskriv din idé och varför den är viktig..."
							/>
						</div>

						<button
							type="submit"
							disabled={!title.trim() || !description.trim()}
							className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors shadow-lg"
						>
							Skicka in förslag
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// DISCUSS VIEW - Discussion and comments for a proposal
// ============================================================================

function DiscussView({ proposal, currentUser, onAddComment, onBack }) {
	const [commentText, setCommentText] = useState("");

	const handleSubmit = (e) => {
		e.preventDefault();
		if (commentText.trim()) {
			onAddComment(proposal.id, commentText.trim());
			setCommentText("");
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 pb-24">
			<div className="bg-blue-600 text-white p-6 shadow-lg">
				<div className="max-w-2xl mx-auto">
					<button
						onClick={onBack}
						className="mb-4 text-white hover:text-yellow-400 font-medium"
					>
						← Tillbaka
					</button>
					<h2 className="text-2xl font-bold">{proposal.title}</h2>
				</div>
			</div>

			<div className="max-w-2xl mx-auto p-6 space-y-6">
				<div className="bg-white rounded-2xl shadow-md p-6">
					<p className="text-gray-700 mb-4">{proposal.description}</p>
					<div className="flex items-center gap-4 text-sm text-gray-500">
						<span>Av {proposal.authorName}</span>
						<span className="flex items-center gap-1">
							<ThumbsUp className="w-4 h-4" />
							{proposal.thumbsUp}
						</span>
					</div>
				</div>

				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-gray-700">
						Diskussion ({proposal.comments.length})
					</h3>

					{proposal.comments.length === 0 ? (
						<div className="bg-white rounded-2xl p-8 text-center text-gray-500">
							<p>
								Inga kommentarer än. Var den första att
								diskutera!
							</p>
						</div>
					) : (
						proposal.comments.map((comment) => (
							<div
								key={comment.id}
								className="bg-white rounded-2xl shadow-md p-6"
							>
								<div className="flex items-start gap-3">
									<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
										<span className="text-blue-600 font-bold">
											{comment.authorName
												.charAt(0)
												.toUpperCase()}
										</span>
									</div>
									<div className="flex-1">
										<p className="font-medium text-gray-800">
											{comment.authorName}
										</p>
										<p className="text-gray-600 mt-1">
											{comment.text}
										</p>
										<p className="text-xs text-gray-400 mt-2">
											{new Date(
												comment.createdAt
											).toLocaleDateString("sv-SE")}
										</p>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg">
				<form
					onSubmit={handleSubmit}
					className="max-w-2xl mx-auto flex gap-3"
				>
					<input
						type="text"
						value={commentText}
						onChange={(e) => setCommentText(e.target.value)}
						className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
						placeholder="Skriv en kommentar..."
					/>
					<button
						type="submit"
						disabled={!commentText.trim()}
						className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors"
					>
						Skicka
					</button>
				</form>
			</div>
		</div>
	);
}

// ============================================================================
// VOTE VIEW - Final voting on top 3 proposals
// ============================================================================

function VoteView({
	proposals,
	currentUser,
	onVote,
	hasVoted,
	getVoteResults,
	onBack,
}) {
	return (
		<div className="min-h-screen bg-gray-50">
			<div className="bg-green-600 text-white p-6 shadow-lg">
				<div className="max-w-2xl mx-auto">
					<button
						onClick={onBack}
						className="mb-4 text-white hover:text-yellow-400 font-medium"
					>
						← Tillbaka
					</button>
					<h2 className="text-2xl font-bold">Rösta på topp 3</h2>
					<p className="text-green-100 mt-2">
						Välj vilka idéer som ska förverkligas
					</p>
				</div>
			</div>

			<div className="max-w-2xl mx-auto p-6 space-y-6">
				{proposals.map((proposal, index) => {
					const voted = hasVoted(proposal.id);
					const results = getVoteResults(proposal.id);

					return (
						<div
							key={proposal.id}
							className="bg-white rounded-2xl shadow-lg p-6 space-y-4"
						>
							<div className="flex items-start gap-3">
								<div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
									<span className="text-blue-800 font-bold text-lg">
										#{index + 1}
									</span>
								</div>
								<div className="flex-1">
									<h4 className="text-lg font-bold text-blue-800 mb-2">
										{proposal.title}
									</h4>
									<p className="text-gray-600">
										{proposal.description}
									</p>
								</div>
							</div>

							{!voted ? (
								<div className="flex gap-3">
									<button
										onClick={() =>
											onVote(proposal.id, "yes")
										}
										className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
									>
										<CheckCircle className="w-5 h-5" />
										Ja
									</button>
									<button
										onClick={() =>
											onVote(proposal.id, "no")
										}
										className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors"
									>
										Nej
									</button>
								</div>
							) : (
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm text-gray-600 mb-1">
										<span>Resultat</span>
										<span>{results.total} röster</span>
									</div>
									<div className="flex gap-2">
										<div className="flex-1 bg-green-100 rounded-lg p-3 text-center">
											<p className="text-2xl font-bold text-green-700">
												{results.yes}
											</p>
											<p className="text-xs text-green-600">
												Ja
											</p>
										</div>
										<div className="flex-1 bg-red-100 rounded-lg p-3 text-center">
											<p className="text-2xl font-bold text-red-700">
												{results.no}
											</p>
											<p className="text-xs text-red-600">
												Nej
											</p>
										</div>
									</div>
									<p className="text-center text-sm text-green-600 font-medium">
										✓ Du har röstat
									</p>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
