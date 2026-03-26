import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ThumbsUp } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import broadcaster from "@/lib/sse-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("Sessions");

/**
 * Checks if automatic phase transition should occur
 * Triggers when BOTH conditions are met:
 * 1. 75% of active users have rated at least one proposal
 * 2. 75% of proposals have been rated
 * Then schedules transition after 90 seconds
 */
export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		// Get sessionId from query parameter (optional for backward compatibility)
		const { sessionId } = req.query;

		// Get active session (with optional sessionId)
		// Only standard sessions can transition to phase 2 (surveys stay in phase 1 until archived)
		const sessionQuery = sessionId
			? { _id: sessionId, status: "active" }
			: { status: "active" };

		const activeSession = await Session.findOne(sessionQuery);

		if (!activeSession || activeSession.phase !== "phase1") {
			return res.status(200).json({ shouldTransition: false });
		}

		// Survey sessions don't transition to phase 2 - they stay in phase 1 until archived
		if (activeSession.sessionType === "survey") {
			return res.status(200).json({ shouldTransition: false });
		}

		// Check if transition is already scheduled
		if (activeSession.phase1TransitionScheduled) {
			const scheduledTime = new Date(
				activeSession.phase1TransitionScheduled
			);
			const now = new Date();
			const secondsRemaining = Math.max(
				0,
				Math.floor((scheduledTime - now) / 1000)
			);

			return res.status(200).json({
				shouldTransition: false,
				transitionScheduled: true,
				scheduledTime: scheduledTime,
				secondsRemaining: secondsRemaining,
			});
		}

		// Count total proposals
		const totalProposals = await Proposal.countDocuments({
			sessionId: activeSession._id,
			status: "active",
		});

		// Need at least 2 proposals to transition
		if (totalProposals < 2) {
			return res.status(200).json({
				shouldTransition: false,
				reason: "Atleast 2 proposals are required",
				progress: {
					totalProposals: totalProposals,
					ratedProposals: 0,
					proposalsPercentage: 0,
					activeUsers: 0,
					usersWhoRated: 0,
					usersPercentage: 0,
				},
			});
		}

		// Get all proposal IDs
		const proposals = await Proposal.find({
			sessionId: activeSession._id,
			status: "active",
		}).select("_id");

		const proposalIds = proposals.map((p) => p._id);

		// Count how many proposals have at least one rating
		const ratedProposalsCount = await Promise.all(
			proposalIds.map(async (id) => {
				const count = await ThumbsUp.countDocuments({ proposalId: id });
				return count > 0 ? 1 : 0;
			})
		).then((results) => results.reduce((sum, val) => sum + val, 0));

		const proposalsPercentage =
			(ratedProposalsCount / totalProposals) * 100;

		// Get active users count and users who have rated
		const activeUsersCount = activeSession.activeUsers?.length || 0;

		// Get unique users who have rated in this session
		const usersWhoRated = await ThumbsUp.distinct("userId", {
			sessionId: activeSession._id,
		});
		const usersWhoRatedCount = usersWhoRated.length;

		const usersPercentage =
			activeUsersCount > 0
				? (usersWhoRatedCount / activeUsersCount) * 100
				: 0;

		// Check both conditions
		const proposalsConditionMet = proposalsPercentage >= 75;
		const usersConditionMet = usersPercentage >= 75 && activeUsersCount > 0;
		const shouldScheduleTransition =
			proposalsConditionMet && usersConditionMet;

		if (shouldScheduleTransition) {
			// Schedule transition for 90 seconds from now
			const scheduledTime = new Date(Date.now() + 90 * 1000);
			activeSession.phase1TransitionScheduled = scheduledTime;
			await activeSession.save();

			// Broadcast transition scheduled event to all connected clients
			await broadcaster.broadcast("transition-scheduled", {
				sessionId: activeSession._id.toString(),
				scheduledTime: scheduledTime,
				secondsRemaining: 90,
			});

			return res.status(200).json({
				shouldTransition: false,
				transitionScheduled: true,
				scheduledTime: scheduledTime,
				secondsRemaining: 90,
				message: "Transition to Phase 2 scheduled in 90 seconds",
			});
		}

		return res.status(200).json({
			shouldTransition: false,
			transitionScheduled: false,
			progress: {
				totalProposals: totalProposals,
				ratedProposals: ratedProposalsCount,
				proposalsPercentage: Math.round(proposalsPercentage),
				activeUsers: activeUsersCount,
				usersWhoRated: usersWhoRatedCount,
				usersPercentage: Math.round(usersPercentage),
				proposalsConditionMet,
				usersConditionMet,
			},
		});
	} catch (error) {
		log.error("Failed to check phase transition", { error: error.message });
		return res.status(500).json({ error: "Failed to check transition" });
	}
}
