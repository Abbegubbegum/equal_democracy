import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess } from "@/lib/admin-helper";
import broadcaster from "@/lib/sse-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminScheduleTermination");

/**
 * Manually schedules Phase 2 termination (60-second countdown).
 * When the timer expires, the session closes and results become visible.
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

		// Use lean() to get raw MongoDB doc (bypasses Mongoose schema cache)
		const activeSession = await Session.findOne({
			_id: sessionId,
			status: "active",
			phase: "phase2",
		}).lean();

		if (!activeSession) {
			return res.status(404).json({ error: "Active phase2 session not found" });
		}

		if (activeSession.phase2TerminationScheduled) {
			const scheduledTime = new Date(activeSession.phase2TerminationScheduled);
			const secondsRemaining = Math.max(0, Math.floor((scheduledTime - new Date()) / 1000));
			return res.status(200).json({
				terminationScheduled: true,
				scheduledTime,
				secondsRemaining,
				message: "Termination already scheduled",
			});
		}

		const scheduledTime = new Date(Date.now() + 60 * 1000);
		// Use updateOne with strict:false to bypass Mongoose cached schema
		await Session.updateOne(
			{ _id: activeSession._id },
			{ $set: { phase2TerminationScheduled: scheduledTime } },
			{ strict: false }
		);

		await broadcaster.broadcast("termination-scheduled", {
			sessionId: activeSession._id.toString(),
			scheduledTime: scheduledTime,
			secondsRemaining: 60,
		});

		return res.status(200).json({
			terminationScheduled: true,
			scheduledTime,
			secondsRemaining: 60,
			message: "Session termination scheduled in 60 seconds",
		});
	} catch (error) {
		log.error("Failed to schedule termination", { error: error.message });
		return res.status(500).json({ error: "Failed to schedule termination" });
	}
}
