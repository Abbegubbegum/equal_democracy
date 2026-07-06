import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ProposalRating } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { getRatingAggregates } from "@/lib/rating-helper";
import { createLogger } from "@/lib/logger";

const log = createLogger("ArchivedSession");

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

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    // Get the closed (archived) session
    const archivedSession = (await Session.findOne({
      _id: id,
      status: "closed",
    })
      .select("_id title startDate endDate activeUsers")
      .lean()) as any;

    if (!archivedSession) {
      return res.status(404).json({ error: "Archived session not found" });
    }

    // Get all proposals for this session, sorted by rating
    const rawProposals = await Proposal.find({ sessionId: id })
      .select("_id title")
      .lean();
    const ratings = await getRatingAggregates(
      ProposalRating,
      "proposalId",
      rawProposals.map((p) => p._id),
    );
    const proposals = rawProposals
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
          b.averageRating - a.averageRating || b.ratingCount - a.ratingCount,
      );

    return res.status(200).json({
      session: {
        _id: archivedSession._id.toString(),
        title: archivedSession.title,
        startDate: archivedSession.startDate,
        endDate: archivedSession.endDate,
        participantCount: archivedSession.activeUsers?.length || 0,
      },
      proposals,
    });
  } catch (error) {
    log.error("Failed to fetch archived session", {
      sessionId: req.query.id,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to fetch archived session" });
  }
}
