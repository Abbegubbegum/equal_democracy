import dbConnect from "@/lib/mongodb";
import { Session, Proposal } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess } from "@/lib/admin-helper";
import broadcaster from "@/lib/sse-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminScheduleTransition");

/**
 * Manually schedules a phase transition (90-second countdown)
 * without requiring the automatic 75% conditions to be met.
 */
export default async function handler(req, res) {
	await dbConnect();

	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session || !hasAdminAccess(session.user)) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	try {
		const { sessionId } = req.body;

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

		// Already scheduled
		if (activeSession.phase1TransitionScheduled) {
			const scheduledTime = new Date(activeSession.phase1TransitionScheduled);
			const secondsRemaining = Math.max(0, Math.floor((scheduledTime - new Date()) / 1000));
			return res.status(200).json({
				transitionScheduled: true,
				scheduledTime,
				secondsRemaining,
				message: "Transition already scheduled",
			});
		}

		// Need at least 2 proposals
		const proposalCount = await Proposal.countDocuments({
			sessionId: activeSession._id,
			status: "active",
		});

		if (proposalCount < 2) {
			return res.status(400).json({
				error: `At least 2 proposals are required. Current count: ${proposalCount}`,
			});
		}

		// Schedule transition for 90 seconds from now
		const scheduledTime = new Date(Date.now() + 90 * 1000);
		activeSession.phase1TransitionScheduled = scheduledTime;
		await activeSession.save();

		// Broadcast transition scheduled event
		await broadcaster.broadcast("transition-scheduled", {
			sessionId: activeSession._id.toString(),
			scheduledTime: scheduledTime,
			secondsRemaining: 90,
		});

		return res.status(200).json({
			transitionScheduled: true,
			scheduledTime,
			secondsRemaining: 90,
			message: "Transition to Phase 2 scheduled in 90 seconds",
		});
	} catch (error) {
		log.error("Failed to schedule transition", { error: error.message });
		return res.status(500).json({ error: "Failed to schedule transition" });
	}
}
