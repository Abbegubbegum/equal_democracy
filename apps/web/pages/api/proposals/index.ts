import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Proposal, ThumbsUp, Comment } from "../../../lib/models";
import {
	getActiveSession,
	registerActiveUser,
} from "../../../lib/session-helper";
import { csrfProtection } from "../../../lib/csrf";
import { hasAdminAccess } from "../../../lib/admin-helper";
import broadcaster from "../../../lib/sse-broadcaster";
import { createLogger } from "../../../lib/logger";

const log = createLogger("Proposals");

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "GET") {
		try {
			// Get authentication session
			const session = await getServerSession(req, res, authOptions);
			const currentUserId = session?.user?.id;

			// Get sessionId from query parameter (optional for backward compatibility)
			const { sessionId } = req.query;

			// Get the active session (with optional sessionId)
			const activeSession = await getActiveSession(sessionId);

			// If no active session, return empty array
			if (!activeSession) {
				return res.status(200).json([]);
			}

			// Only get proposals from the active session
			const proposals = await Proposal.find({
				sessionId: activeSession._id,
			})
				.sort({ createdAt: -1 })
				.lean();

			const proposalsWithCounts = await Promise.all(
				proposals.map(async (proposal) => {
					const thumbsUpCount = await ThumbsUp.countDocuments({
						proposalId: proposal._id,
					});
					const commentsCount = await Comment.countDocuments({
						proposalId: proposal._id,
					});

					// Only include authorId and authorName if this is the user's own proposal
					const isOwnProposal = currentUserId && proposal.authorId.toString() === currentUserId;

					return {
						...proposal,
						_id: proposal._id.toString(),
						authorId: isOwnProposal ? proposal.authorId.toString() : undefined,
						authorName: isOwnProposal ? proposal.authorName : undefined,
						thumbsUpCount,
						commentsCount,
					};
				})
			);

			return res.status(200).json(proposalsWithCounts);
		} catch (error) {
			log.error("Failed to fetch proposals", { error: error.message });
			return res.status(500).json({ message: "An error has occured" });
		}
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res
				.status(401)
				.json({ message: "You have to be logged in" });
		}

		const { title, problem, solution, sessionId } = req.body;

		try {
			// Get the active session (with optional sessionId)
			const activeSession = await getActiveSession(sessionId);

			// If no active session, cannot create proposal
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "No active session exists" });
			}

			// Validate fields based on noMotivation setting
			if (!title) {
				return res.status(400).json({ message: "Title is required" });
			}

			// Only require problem and solution if noMotivation is false
			if (!activeSession.noMotivation && (!problem || !solution)) {
				return res.status(400).json({ message: "All fields are required" });
			}

			// Check if session has maxOneProposalPerUser enabled
			// Admins are exempt to allow manual entry of paper proposals
			if (activeSession.maxOneProposalPerUser && !hasAdminAccess(session.user)) {
				// Check if user already has a proposal in this session
				const userProposalCount = await Proposal.countDocuments({
					sessionId: activeSession._id,
					authorId: session.user.id,
					status: { $in: ["active", "top3"] },
				});

				if (userProposalCount > 0) {
					return res.status(400).json({
						message:
							"You have already submitted a proposal in this session.",
					});
				}
			}

			// Check if transition is scheduled - block new proposals during countdown
			if (activeSession.phase1TransitionScheduled) {
				return res.status(400).json({
					message:
						"Cannot create new proposals - phase transition is scheduled",
				});
			}

			// Check for duplicate proposal title in current session
			const existingProposal = await Proposal.findOne({
				sessionId: activeSession._id,
				title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
				status: { $in: ["active", "top3"] },
			});

			if (existingProposal) {
				return res.status(400).json({
					message:
						"A proposal with this title already exists, please pick a new title.",
				});
			}

			const proposal = await Proposal.create({
				sessionId: activeSession._id,
				title,
				problem,
				solution,
				authorId: session.user.id,
				authorName: session.user.name,
				status: "active",
				thumbsUpCount: 0,
			});

			// Register user as active in session
			await registerActiveUser(session.user.id, activeSession._id.toString());

			// Broadcast new proposal event to all connected clients
			// Note: authorId and authorName removed for anonymity
			await broadcaster.broadcast("new-proposal", {
				_id: proposal._id.toString(),
				sessionId: proposal.sessionId.toString(),
				title: proposal.title,
				problem: proposal.problem,
				solution: proposal.solution,
				status: proposal.status,
				thumbsUpCount: 0,
				averageRating: 0,
				yesVotes: 0,
				noVotes: 0,
				createdAt: proposal.createdAt,
				commentsCount: 0,
			});

			return res.status(201).json({
				...proposal.toObject(),
				_id: proposal._id.toString(),
				authorId: proposal.authorId.toString(),
			});
		} catch (error) {
			log.error("Failed to create proposal", { error: error.message });
			return res.status(500).json({
				message: "An error occurred while creating proposals",
			});
		}
	}

	if (req.method === "PATCH") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res
				.status(401)
				.json({ message: "You have to be logged in" });
		}

		const { action, proposalIds } = req.body;

		if (
			action === "moveToTop3" &&
			proposalIds &&
			Array.isArray(proposalIds)
		) {
			try {
				await Proposal.updateMany(
					{ _id: { $in: proposalIds } },
					{ $set: { status: "top3" } }
				);

				return res.status(200).json({ message: "Top 3 updated" });
			} catch (error) {
				log.error("Failed to update proposal", { error: error.message });
				return res
					.status(500)
					.json({ message: "An error has occured" });
			}
		}

		return res.status(400).json({ message: "Bad request" });
	}

	return res.status(405).json({ message: "Method not allowed" });
}
