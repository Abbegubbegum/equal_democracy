import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Session, TopProposal } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileArchived");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  try {
    verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await connectDB();

    const sessions = await Session.find({
      status: { $in: ["closed", "archived"] },
      sessionType: { $nin: ["municipal", "voting"] },
    })
      .select("_id place startDate endDate status")
      .sort({ startDate: -1 })
      .lean();

    const result = await Promise.all(
      sessions.map(async (session) => {
        const topProposals = await TopProposal.find({ sessionId: session._id })
          .select("title yesVotes noVotes authorName")
          .lean();
        return {
          id: session._id.toString(),
          place: session.place,
          startDate: session.startDate,
          endDate: session.endDate || null,
          status: session.status,
          topProposals: topProposals.map((tp) => ({
            title: tp.title,
            yesVotes: tp.yesVotes,
            noVotes: tp.noVotes,
            authorName: tp.authorName,
          })),
        };
      })
    );

    return res.status(200).json(result);
  } catch (error) {
    log.error("Failed to fetch archived sessions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch archive" });
  }
}
