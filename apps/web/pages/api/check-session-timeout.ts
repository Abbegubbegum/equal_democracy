import dbConnect from "@/lib/mongodb";
import { Session, Settings } from "@/lib/models";
import { closeSession } from "@/lib/session-close";
import { createLogger } from "@/lib/logger";

const log = createLogger("SessionTimeout");

/**
 * API endpoint to check and automatically close sessions that have exceeded their time limit
 * This can be called periodically by a cron job or manually
 */
export default async function handler(req, res) {
	if (req.method !== "POST" && req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		await dbConnect();

		// Get the session limit from settings
		const settings = await Settings.findOne({});
		const sessionLimitHours = settings?.sessionLimitHours || 24;

		// Find all active sessions
		const activeSessions = await Session.find({ status: "active" });

		if (!activeSessions || activeSessions.length === 0) {
			return res.status(200).json({
				message: "No active sessions to check",
				checked: 0,
				closed: 0,
			});
		}

		const currentTime = new Date();
		const closedSessions = [];

		// Check each active session
		for (const session of activeSessions) {
			if (!session.startDate) continue;

			const sessionStartTime = new Date(session.startDate);
			const elapsedHours =
				(currentTime - sessionStartTime) / (1000 * 60 * 60);

			// If session has exceeded the time limit, close it
			if (elapsedHours >= sessionLimitHours) {
				log.info("Session exceeded time limit", {
					sessionId: session._id.toString(),
					elapsedHours: elapsedHours.toFixed(1),
					limitHours: sessionLimitHours,
				});

				await closeSession(session);
				closedSessions.push({
					sessionId: session._id,
					place: session.place,
					elapsedHours: elapsedHours.toFixed(1),
					limitHours: sessionLimitHours,
				});
			}
		}

		return res.status(200).json({
			message: `Checked ${activeSessions.length} session(s), closed ${closedSessions.length}`,
			checked: activeSessions.length,
			closed: closedSessions.length,
			closedSessions,
			sessionLimitHours,
		});
	} catch (error) {
		log.error("Failed to check session timeouts", { error: error.message });
		return res.status(500).json({
			error: "Failed to check session timeouts",
			details: error.message,
		});
	}
}
