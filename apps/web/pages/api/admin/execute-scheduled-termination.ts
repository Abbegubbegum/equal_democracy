import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { closeSession } from "@/lib/session-close";
import broadcaster from "@/lib/sse-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("ExecuteScheduledTermination");

/**
 * Executes a scheduled Phase 2 termination when the 60-second timer expires.
 * Uses atomic query to prevent double execution from concurrent clients.
 */
export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { sessionId } = req.body;
		const now = new Date();

		// Use lean() for raw MongoDB doc (bypasses Mongoose schema cache)
		const pendingSession = await Session.findOne({
			...(sessionId ? { _id: sessionId } : {}),
			status: "active",
			phase: "phase2",
			phase2TerminationScheduled: { $exists: true, $ne: null },
		}).lean();

		if (!pendingSession) {
			return res.status(200).json({
				terminationExecuted: false,
				message: "No pending termination",
			});
		}

		const scheduledTime = new Date(pendingSession.phase2TerminationScheduled);

		// If time hasn't passed yet, return countdown
		if (now < scheduledTime) {
			const secondsRemaining = Math.floor((scheduledTime - now) / 1000);
			return res.status(200).json({
				terminationExecuted: false,
				secondsRemaining,
			});
		}

		// Time has passed — use atomic findOneAndUpdate to claim the termination lock
		const activeSession = await Session.findOneAndUpdate(
			{
				...(sessionId ? { _id: sessionId } : {}),
				status: "active",
				phase: "phase2",
				phase2TerminationScheduled: {
					$exists: true,
					$lte: now,
				},
			},
			{
				$set: { phase2TerminationScheduled: null },
			},
			{
				new: false,
				strict: false,
			}
		);

		if (!activeSession) {
			return res.status(200).json({
				terminationExecuted: false,
				message: "Termination already executed by another request",
			});
		}

		log.info("Executing scheduled termination", {
			sessionId: activeSession._id.toString(),
		});

		// Re-fetch the session since closeSession needs a fresh document
		const sessionToClose = await Session.findById(activeSession._id);
		const result = await closeSession(sessionToClose, { sendEmails: true });

		if (result.tiebreakerStarted) {
			// Tie detected — broadcast tiebreaker event instead of closing
			await broadcaster.broadcast("tiebreaker-started", {
				sessionId: activeSession._id.toString(),
				tiedProposalIds: result.tiedProposalIds,
				scheduledTime: result.scheduledTime,
				secondsRemaining: result.secondsRemaining,
			});

			log.info("Tiebreaker started after termination", {
				sessionId: activeSession._id.toString(),
				tiedCount: result.tiedProposalIds.length,
			});

			return res.status(200).json({
				terminationExecuted: false,
				tiebreakerStarted: true,
				tiedProposalIds: result.tiedProposalIds,
				secondsRemaining: result.secondsRemaining,
			});
		}

		await broadcaster.broadcast("phase-change", {
			phase: "closed",
			sessionId: activeSession._id.toString(),
		});

		log.info("Session terminated successfully", {
			sessionId: activeSession._id.toString(),
		});

		return res.status(200).json({
			terminationExecuted: true,
			sessionId: activeSession._id.toString(),
		});
	} catch (error) {
		log.error("Failed to execute termination", { error: error.message });
		return res.status(500).json({ error: "Failed to execute termination" });
	}
}
