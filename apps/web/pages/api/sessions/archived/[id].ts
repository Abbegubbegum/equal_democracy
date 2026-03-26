import dbConnect from "@/lib/mongodb";
import { Session, Proposal } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { createLogger } from "@/lib/logger";

const log = createLogger("ArchivedSession");

export default async function handler(req, res) {
	await dbConnect();

	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const { id } = req.query;

	if (!id) {
		return res.status(400).json({ error: "Session ID is required" });
	}

	try {
		// Get the archived session
		const archivedSession = await Session.findOne({
			_id: id,
			status: "archived",
		})
			.select("_id place startDate endDate surveyDurationDays activeUsers sessionType")
			.lean();

		if (!archivedSession) {
			return res.status(404).json({ error: "Archived session not found" });
		}

		// Get all proposals for this session, sorted by rating
		const proposals = await Proposal.find({ sessionId: id })
			.select("_id title averageRating thumbsUpCount")
			.sort({ averageRating: -1, thumbsUpCount: -1 })
			.lean();

		return res.status(200).json({
			session: {
				_id: archivedSession._id.toString(),
				place: archivedSession.place,
				startDate: archivedSession.startDate,
				endDate: archivedSession.endDate,
				surveyDurationDays: archivedSession.surveyDurationDays || 6,
				participantCount: archivedSession.activeUsers?.length || 0,
				sessionType: archivedSession.sessionType || "survey",
			},
			proposals: proposals.map((p) => ({
				_id: p._id.toString(),
				title: p.title,
				averageRating: p.averageRating || 0,
				thumbsUpCount: p.thumbsUpCount || 0,
			})),
		});
	} catch (error) {
		log.error("Failed to fetch archived session", { sessionId: req.query.id, error: error.message });
		return res.status(500).json({ error: "Failed to fetch archived session" });
	}
}
