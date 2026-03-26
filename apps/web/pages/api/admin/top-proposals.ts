import dbConnect from "@/lib/mongodb";
import { TopProposal } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createLogger } from "@/lib/logger";

const log = createLogger("TopProposals");

export default async function handler(req, res) {
	await dbConnect();

	// Check if user is admin
	const session = await getServerSession(req, res, authOptions);
	if (!session || !session.user?.isAdmin) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	if (req.method === "GET") {
		try {
			// Get all top proposals, sorted by archived date (newest first)
			const topProposals = await TopProposal.find().sort({
				archivedAt: -1,
			});

			// Format the response
			const formatted = topProposals.map((tp) => ({
				id: tp._id.toString(),
				sessionPlace: tp.sessionPlace,
				sessionStartDate: tp.sessionStartDate,
				title: tp.title,
				problem: tp.problem,
				solution: tp.solution,
				estimatedCost: tp.estimatedCost,
				yesVotes: tp.yesVotes,
				noVotes: tp.noVotes,
				archivedAt: tp.archivedAt,
			}));

			return res.status(200).json(formatted);
		} catch (error) {
			log.error("Failed to fetch top proposals", { error: error.message });
			return res
				.status(500)
				.json({ error: "Failed to fetch top proposals" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
