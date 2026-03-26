import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ThumbsUp, FinalVote } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess } from "@/lib/admin-helper";
import { createLogger } from "@/lib/logger";

const log = createLogger("LivePanel");

export default async function handler(req, res) {
	await dbConnect();

	const session = await getServerSession(req, res, authOptions);
	if (!session || !hasAdminAccess(session.user)) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	if (req.method === "GET") {
		try {
			const { sessionId } = req.query;
			if (!sessionId) {
				return res.status(400).json({ error: "sessionId is required" });
			}

			// Use lean() for raw MongoDB doc (bypasses Mongoose schema cache for new fields)
			const activeSession = await Session.findOne({
				_id: sessionId,
				status: "active",
			}).lean();

			if (!activeSession) {
				return res.status(404).json({ error: "Active session not found" });
			}

			const activeUsersCount = activeSession.activeUsers?.length || 0;

			// Phase 2: voting metrics
			if (activeSession.phase === "phase2") {
				const usersWhoVoted = await FinalVote.distinct("userId", {
					sessionId: activeSession._id,
				});
				const usersWhoVotedCount = usersWhoVoted.length;

				const votedPercentage = activeUsersCount > 0
					? (usersWhoVotedCount / activeUsersCount) * 100
					: 0;
				const terminationConditionMet = votedPercentage >= 75 && activeUsersCount > 0;

				const terminationScheduled = !!activeSession.phase2TerminationScheduled;
				let scheduledTime = null;
				let secondsRemaining = null;

				if (terminationScheduled) {
					scheduledTime = new Date(activeSession.phase2TerminationScheduled);
					const now = new Date();
					secondsRemaining = Math.max(0, Math.floor((scheduledTime - now) / 1000));
				}

				return res.status(200).json({
					phase: "phase2",
					activeUsersCount,
					usersWhoVotedCount,
					terminationScheduled,
					scheduledTime,
					secondsRemaining,
					terminationConditionMet,
				});
			}

			// Phase 1: rating metrics
			const totalProposals = await Proposal.countDocuments({
				sessionId: activeSession._id,
				status: "active",
			});

			const proposalIds = await Proposal.find({
				sessionId: activeSession._id,
				status: "active",
			}).select("_id");

			const ratedProposals = await Promise.all(
				proposalIds.map(async (p) => {
					const count = await ThumbsUp.countDocuments({ proposalId: p._id });
					return count > 0 ? 1 : 0;
				})
			).then((results) => results.reduce((sum, val) => sum + val, 0));

			const usersWhoRated = await ThumbsUp.distinct("userId", {
				sessionId: activeSession._id,
			});
			const usersWhoRatedCount = usersWhoRated.length;

			const transitionScheduled = !!activeSession.phase1TransitionScheduled;
			let scheduledTime = null;
			let secondsRemaining = null;

			if (transitionScheduled) {
				scheduledTime = new Date(activeSession.phase1TransitionScheduled);
				const now = new Date();
				secondsRemaining = Math.max(0, Math.floor((scheduledTime - now) / 1000));
			}

			const calculatedTopCount = totalProposals >= 2
				? Math.max(2, Math.min(totalProposals, Math.round(1.2 * Math.sqrt(totalProposals))))
				: 0;

			const proposalsPercentage = totalProposals > 0 ? (ratedProposals / totalProposals) * 100 : 0;
			const usersPercentage = activeUsersCount > 0 ? (usersWhoRatedCount / activeUsersCount) * 100 : 0;
			const conditionsMet = proposalsPercentage >= 75 && usersPercentage >= 75 && activeUsersCount > 0 && totalProposals >= 2;

			return res.status(200).json({
				phase: activeSession.phase,
				activeUsersCount,
				usersWhoRatedCount,
				totalProposals,
				ratedProposals,
				transitionScheduled,
				scheduledTime,
				secondsRemaining,
				calculatedTopCount,
				customTopCount: activeSession.customTopCount || null,
				conditionsMet,
			});
		} catch (error) {
			log.error("Failed to fetch live panel data", { error: error.message });
			return res.status(500).json({ error: "Failed to fetch live panel data" });
		}
	}

	if (req.method === "PATCH") {
		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const { sessionId, customTopCount } = req.body;

			if (!sessionId) {
				return res.status(400).json({ error: "sessionId is required" });
			}

			const activeSession = await Session.findOne({
				_id: sessionId,
				status: "active",
				phase: "phase1",
			});

			if (!activeSession) {
				return res.status(404).json({ error: "Active phase1 session not found" });
			}

			// Validate customTopCount
			const totalProposals = await Proposal.countDocuments({
				sessionId: activeSession._id,
				status: "active",
			});

			const count = parseInt(customTopCount);
			if (isNaN(count) || count < 2 || count > totalProposals) {
				return res.status(400).json({
					error: `customTopCount must be between 2 and ${totalProposals}`,
				});
			}

			activeSession.customTopCount = count;
			await activeSession.save();

			return res.status(200).json({ customTopCount: count });
		} catch (error) {
			log.error("Failed to update custom top count", { error: error.message });
			return res.status(500).json({ error: "Failed to update custom top count" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
