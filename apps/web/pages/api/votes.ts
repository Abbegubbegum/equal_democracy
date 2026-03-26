import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import {
	FinalVote,
	Session,
	Settings,
} from "../../lib/models";
import { getActiveSession, registerActiveUser } from "../../lib/session-helper";
import { validateObjectId, toObjectId } from "../../lib/validation";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/sse-broadcaster";
import { closeSession } from "../../lib/session-close";
import { createLogger } from "../../lib/logger";

const log = createLogger("Votes");

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res
				.status(401)
				.json({ message: "You have to be logged in" });
		}

		const { proposalId, choice, sessionId } = req.body;

		if (!proposalId || !choice) {
			return res
				.status(400)
				.json({ message: "Proposal ID and choice is required" });
		}

		if (!validateObjectId(proposalId)) {
			return res
				.status(400)
				.json({ message: "Invalid proposal ID format" });
		}

		if (!["yes", "no"].includes(choice)) {
			return res
				.status(400)
				.json({ message: 'Choice needs to be "yes" or "no"' });
		}

		try {
			// Get the active session (with optional sessionId)
			const activeSession = await getActiveSession(sessionId);

			// If no active session, cannot vote
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "No active session exists" });
			}

			// Check if termination countdown is active (allows vote changes)
			const rawSession = await Session.findById(activeSession._id).lean();
			const terminationActive = !!rawSession?.phase2TerminationScheduled;

			// During tiebreaker, only allow votes on the tied proposals
			if (rawSession?.tiebreakerActive) {
				const tiedIds = (rawSession.tiebreakerProposals || []).map(id => id.toString());
				if (!tiedIds.includes(proposalId.toString())) {
					return res.status(400).json({
						message: "Under förlängd omröstning kan du bara rösta på de oavgjorda förslagen.",
					});
				}
			}

			// Server-side guard: onlyYesVotes sessions only accept "yes" votes
			if (rawSession?.onlyYesVotes && choice !== "yes") {
				return res.status(400).json({
					message: "This session only accepts yes-votes.",
				});
			}

			// Check if user already voted in this session (1 vote per session)
			const existingVoteInSession = await FinalVote.findOne({
				sessionId: activeSession._id,
				userId: session.user.id,
			});

			if (existingVoteInSession) {
				if (terminationActive) {
					// During termination countdown: allow vote change
					await FinalVote.deleteMany({
						sessionId: activeSession._id,
						userId: session.user.id,
					});
				} else {
					return res.status(400).json({
						message:
							"You have already used your vote this session.",
					});
				}
			}

			await FinalVote.create({
				sessionId: activeSession._id,
				proposalId: toObjectId(proposalId),
				userId: session.user.id,
				choice,
			});

			// Register user as active in session
			await registerActiveUser(session.user.id, activeSession._id.toString());

			const yesCount = await FinalVote.countDocuments({
				sessionId: activeSession._id,
				proposalId: toObjectId(proposalId),
				choice: "yes",
			});
			const noCount = await FinalVote.countDocuments({
				sessionId: activeSession._id,
				proposalId: toObjectId(proposalId),
				choice: "no",
			});

			// Broadcast vote update event
			await broadcaster.broadcast("vote-update", {
				proposalId: proposalId.toString(),
				yes: yesCount,
				no: noCount,
				total: yesCount + noCount,
			});

			// Re-fetch session to get latest activeUsers list
			const freshSession = await getActiveSession(activeSession._id.toString());

			// Check if session should auto-close
			const shouldClose = await checkAutoClose(freshSession);

			// If session closed, broadcast phase change
			if (shouldClose) {
				log.info("Session auto-closed after vote", { sessionId: freshSession._id.toString() });
				await broadcaster.broadcast("phase-change", {
					phase: "closed",
					sessionId: freshSession._id.toString(),
				});
			}

			return res.status(201).json({
				message: "Vote registered",
				results: {
					yes: yesCount,
					no: noCount,
					total: yesCount + noCount,
				},
				sessionClosed: shouldClose,
			});
		} catch (error) {
			log.error("Failed to create vote", { error: error.message });
			return res.status(500).json({ message: "An error has occured" });
		}
	}

	if (req.method === "GET") {
		const session = await getServerSession(req, res, authOptions);
		const { proposalId, userId, checkSession, sessionId } = req.query;

		// Check if user has voted in the current session
		if (checkSession === "true" && session) {
			try {
				const activeSession = await getActiveSession(sessionId);

				// If no active session, cannot vote
				if (!activeSession) {
					return res
						.status(400)
						.json({ message: "No active session exists" });
				}

				const userVote = await FinalVote.findOne({
					sessionId: activeSession._id,
					userId: session.user.id,
				}).populate("proposalId");

				return res.status(200).json({
					hasVotedInSession: !!userVote,
					votedProposalId:
						userVote?.proposalId?._id?.toString() || null,
					votedProposalTitle: userVote?.proposalId?.title || null,
				});
			} catch (error) {
				log.error("Failed to check session vote", { error: error.message });
				return res
					.status(500)
					.json({ message: "An error has occured" });
			}
		}

		if (proposalId) {
			if (!validateObjectId(proposalId)) {
				return res
					.status(400)
					.json({ message: "Invalid proposal ID format" });
			}

			if (userId && !validateObjectId(userId)) {
				return res
					.status(400)
					.json({ message: "Invalid user ID format" });
			}

			try {
				const activeSession = await getActiveSession(sessionId);
				const voteSessionId = activeSession ? activeSession._id : toObjectId(sessionId);
				const yesCount = await FinalVote.countDocuments({
					sessionId: voteSessionId,
					proposalId: toObjectId(proposalId),
					choice: "yes",
				});
				const noCount = await FinalVote.countDocuments({
					sessionId: voteSessionId,
					proposalId: toObjectId(proposalId),
					choice: "no",
				});

				let hasVoted = false;
				if (userId) {
					hasVoted = await FinalVote.exists({
						proposalId: toObjectId(proposalId),
						userId: toObjectId(userId),
					});
				}

				return res.status(200).json({
					yes: yesCount,
					no: noCount,
					total: yesCount + noCount,
					hasVoted: !!hasVoted,
				});
			} catch (error) {
				log.error("Failed to fetch vote results", { error: error.message });
				return res
					.status(500)
					.json({ message: "An error has occured" });
			}
		}

		return res.status(400).json({ message: "Proposal ID is required" });
	}

	return res.status(405).json({ message: "Method not allowed" });
}

// Helper function to check if session should auto-close
async function checkAutoClose(activeSession) {
	try {
		// Only check in phase 2
		if (activeSession.phase !== "phase2") {
			return false;
		}

		// Don't auto-close if a termination timer is active — let the timer handle it
		const rawSession = await Session.findById(activeSession._id).lean();
		if (rawSession?.phase2TerminationScheduled) {
			return false;
		}

		// Check condition 1: All active users have voted
		const activeUserIds = activeSession.activeUsers || [];

		if (activeUserIds.length > 0) {
			const votedUserIds = await FinalVote.distinct("userId", {
				sessionId: activeSession._id,
			});

			const allUsersVoted = activeUserIds.every((userId) =>
				votedUserIds.some(
					(votedId) => votedId.toString() === userId.toString()
				)
			);

			if (allUsersVoted) {
				log.info("All users voted, closing session", {
					sessionId: activeSession._id.toString(),
					userCount: activeUserIds.length,
				});
				const result = await closeSession(activeSession, { sendEmails: true });
				if (result.tiebreakerStarted) {
					await broadcaster.broadcast("tiebreaker-started", {
						sessionId: activeSession._id.toString(),
						tiedProposalIds: result.tiedProposalIds,
						scheduledTime: result.scheduledTime,
						secondsRemaining: result.secondsRemaining,
					});
					return false;
				}
				return true;
			}
		}

		// Check condition 2: Time limit exceeded
		if (activeSession.startDate) {
			const settings = await Settings.findOne({});
			const sessionLimitHours = settings?.sessionLimitHours || 24;

			const sessionStartTime = new Date(activeSession.startDate);
			const currentTime = new Date();
			const elapsedHours =
				(currentTime - sessionStartTime) / (1000 * 60 * 60);

			if (elapsedHours >= sessionLimitHours) {
				log.info("Session time limit exceeded, closing", {
					sessionId: activeSession._id.toString(),
					elapsedHours: elapsedHours.toFixed(1),
					limitHours: sessionLimitHours,
				});
				await closeSession(activeSession, { sendEmails: true });
				return true;
			}
		}

		return false;
	} catch (error) {
		log.error("Failed to check auto-close", { error: error.message });
		return false;
	}
}
