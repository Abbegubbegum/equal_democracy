import dbConnect from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { Session } from "@/lib/models";
import { getActiveSession } from "@/lib/session-helper";
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
		// Get sessionId from query parameter (optional for backward compatibility)
		const { sessionId } = req.query;

		const activeSession = await getActiveSession(sessionId);

		// If no active session exists, return null
		if (!activeSession) {
			return res.status(200).json({
				noActiveSession: true,
				phase: null,
				status: null,
			});
		}

		// Users are now only registered as active when they perform actions
		// (create proposal, rate, vote, comment) via registerActiveUser() helper

		// Use lean() to get raw doc with phase2TerminationScheduled (bypasses schema cache)
		const rawSession = await Session.findById(activeSession._id).lean();
		let terminationSecondsRemaining = null;
		if (rawSession?.phase2TerminationScheduled) {
			const scheduledTime = new Date(rawSession.phase2TerminationScheduled);
			terminationSecondsRemaining = Math.max(0, Math.floor((scheduledTime - new Date()) / 1000));
		}

		// Tiebreaker state
		let tiebreakerSecondsRemaining = null;
		let tiebreakerProposalIds = null;
		const tiebreakerActive = !!rawSession?.tiebreakerActive;
		if (tiebreakerActive && rawSession?.tiebreakerScheduled) {
			const tbTime = new Date(rawSession.tiebreakerScheduled);
			tiebreakerSecondsRemaining = Math.max(0, Math.floor((tbTime - new Date()) / 1000));
			tiebreakerProposalIds = (rawSession.tiebreakerProposals || []).map(id => id.toString());
		}

		return res.status(200).json({
			_id: activeSession._id.toString(),
			place: activeSession.place,
			status: activeSession.status,
			phase: activeSession.phase,
			activeUsersCount: activeSession.activeUsers?.length || 0,
			showUserCount: activeSession.showUserCount !== undefined ? activeSession.showUserCount : false,
			noMotivation: activeSession.noMotivation !== undefined ? activeSession.noMotivation : false,
			onlyYesVotes: activeSession.onlyYesVotes || false,
			sessionType: activeSession.sessionType || "standard",
			archiveDate: activeSession.archiveDate,
			surveyDurationDays: activeSession.surveyDurationDays,
			terminationSecondsRemaining,
			tiebreakerActive,
			tiebreakerSecondsRemaining,
			tiebreakerProposalIds,
		});
	} catch (error) {
		log.error("Failed to fetch current session", { error: error.message });
		return res.status(500).json({ error: "Failed to fetch session" });
	}
}
