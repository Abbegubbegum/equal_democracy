import dbConnect from "@/lib/mongodb";
import { Session, Proposal } from "@/lib/models";
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
		// Get all archived sessions (survey type)
		const archivedSessions = await Session.find({
			status: "archived",
		})
			.select("_id place startDate endDate surveyDurationDays activeUsers")
			.sort({ endDate: -1 })
			.lean();

		// For each archived session, get the top proposals with their ratings
		const sessionsWithProposals = await Promise.all(
			archivedSessions.map(async (s) => {
				const proposals = await Proposal.find({ sessionId: s._id })
					.select("_id title averageRating thumbsUpCount")
					.sort({ averageRating: -1, thumbsUpCount: -1 })
					.limit(10)
					.lean();

				return {
					_id: s._id.toString(),
					place: s.place,
					startDate: s.startDate,
					endDate: s.endDate,
					surveyDurationDays: s.surveyDurationDays || 6,
					participantCount: s.activeUsers?.length || 0,
					topProposals: proposals.map((p) => ({
						_id: p._id.toString(),
						title: p.title,
						averageRating: p.averageRating || 0,
						thumbsUpCount: p.thumbsUpCount || 0,
					})),
				};
			})
		);

		return res.status(200).json(sessionsWithProposals);
	} catch (error) {
		log.error("Failed to fetch archived sessions", { error: error.message });
		return res.status(500).json({ error: "Failed to fetch archived sessions" });
	}
}
