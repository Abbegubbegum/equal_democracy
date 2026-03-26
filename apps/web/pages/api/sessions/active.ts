import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createLogger } from "@/lib/logger";

const log = createLogger("Sessions");

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
		// Get all active sessions
		const activeSessions = await Session.find({ status: "active" })
			.select("_id place phase startDate showUserCount noMotivation singleResult activeUsers sessionType archiveDate surveyDurationDays")
			.sort({ startDate: -1 })
			.lean();

		// Transform to include active user count
		const sessionsWithCount = activeSessions.map((s) => ({
			_id: s._id.toString(),
			place: s.place,
			phase: s.phase,
			startDate: s.startDate,
			showUserCount: s.showUserCount || false,
			noMotivation: s.noMotivation || false,
			singleResult: s.singleResult || false,
			activeUsersCount: s.activeUsers?.length || 0,
			sessionType: s.sessionType || "standard",
			archiveDate: s.archiveDate,
			surveyDurationDays: s.surveyDurationDays,
		}));

		return res.status(200).json(sessionsWithCount);
	} catch (error) {
		log.error("Failed to fetch active sessions", { error: error.message });
		return res.status(500).json({ error: "Failed to fetch active sessions" });
	}
}
