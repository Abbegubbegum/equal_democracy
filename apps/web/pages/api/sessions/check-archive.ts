import dbConnect from "@/lib/mongodb";
import { Session, Proposal } from "@/lib/models";
import broadcaster from "@/lib/sse-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("Sessions");

export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const now = new Date();

		// Find all active survey sessions that have passed their archive date
		const expiredSessions = await Session.find({
			sessionType: "survey",
			status: "active",
			archiveDate: { $lte: now },
		});

		const archivedSessions = [];

		for (const session of expiredSessions) {
			// Update session status to archived
			session.status = "archived";
			session.endDate = now;
			await session.save();

			// Archive all proposals in the session
			await Proposal.updateMany(
				{ sessionId: session._id },
				{ status: "archived" }
			);

			archivedSessions.push({
				_id: session._id.toString(),
				place: session.place,
			});

			// Broadcast the archive event
			await broadcaster.broadcast("session-archived", {
				sessionId: session._id.toString(),
				place: session.place,
			});
		}

		return res.status(200).json({
			archivedCount: archivedSessions.length,
			archivedSessions,
		});
	} catch (error) {
		log.error("Failed to check sessions to archive", { error: error.message });
		return res.status(500).json({ error: "Failed to check for sessions to archive" });
	}
}
