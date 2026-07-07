import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { WinningProposal } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminWinningProposals");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await dbConnect();

  // Check if user is admin
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.isAdmin) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      // Get all winning proposals, sorted by archived date (newest first)
      const winningProposals = await WinningProposal.find().sort({
        archivedAt: -1,
      });

      // Format the response
      const formatted = winningProposals.map((wp) => ({
        id: wp._id.toString(),
        sessionTitle: wp.sessionTitle,
        sessionStartDate: wp.sessionStartDate,
        title: wp.title,
        problem: wp.problem,
        solution: wp.solution,
        yesVotes: wp.yesVotes,
        noVotes: wp.noVotes,
        archivedAt: wp.archivedAt,
      }));

      return res.status(200).json(formatted);
    } catch (error) {
      log.error("Failed to fetch winning proposals", { error: error.message });
      return res
        .status(500)
        .json({ error: "Failed to fetch winning proposals" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
