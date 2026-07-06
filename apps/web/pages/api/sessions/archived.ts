import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ProposalRating } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getRatingAggregates } from "@/lib/rating-helper";
import { createLogger } from "@/lib/logger";

const log = createLogger("Sessions");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get all closed (archived) sessions
    const archivedSessions = await Session.find({
      status: "closed",
    })
      .select("_id title startDate endDate activeUsers")
      .sort({ endDate: -1 })
      .lean();

    // For each archived session, get the top-rated proposals
    const sessionsWithProposals = await Promise.all(
      archivedSessions.map(async (s) => {
        const proposals = await Proposal.find({ sessionId: s._id })
          .select("_id title")
          .lean();
        const ratings = await getRatingAggregates(
          ProposalRating,
          "proposalId",
          proposals.map((p) => p._id),
        );

        const topProposals = proposals
          .map((p) => {
            const agg = ratings.get(p._id.toString());
            return {
              _id: p._id.toString(),
              title: p.title,
              averageRating: agg?.averageRating || 0,
              ratingCount: agg?.ratingCount || 0,
            };
          })
          .sort(
            (a, b) =>
              b.averageRating - a.averageRating ||
              b.ratingCount - a.ratingCount,
          )
          .slice(0, 10);

        return {
          _id: s._id.toString(),
          title: s.title,
          startDate: s.startDate,
          endDate: s.endDate,
          participantCount: s.activeUsers?.length || 0,
          topProposals,
        };
      }),
    );

    return res.status(200).json(sessionsWithProposals);
  } catch (error) {
    log.error("Failed to fetch archived sessions", { error: error.message });
    return res.status(500).json({ error: "Failed to fetch archived sessions" });
  }
}
