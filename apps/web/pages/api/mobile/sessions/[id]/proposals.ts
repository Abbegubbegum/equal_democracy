import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../../lib/mongodb";
import { Proposal, ProposalRating } from "../../../../../lib/models";
import { getRatingAggregates } from "../../../../../lib/rating-helper";
import { verifyBearerToken } from "../../../../../lib/mobile-jwt";
import { createLogger } from "../../../../../lib/logger";

const log = createLogger("MobileProposals");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id: sessionId } = req.query;

  await connectDB();

  if (req.method === "GET") {
    try {
      const proposals = await Proposal.find({ sessionId, status: "active" })
        .select("_id title problem solution createdAt")
        .lean();

      const proposalIds = proposals.map((p) => p._id);
      const ratings = await getRatingAggregates(
        ProposalRating,
        "proposalId",
        proposalIds,
      );
      const userRatings = await ProposalRating.find({
        proposalId: { $in: proposalIds },
        userId: user.id,
      }).lean();
      const userRatingMap = Object.fromEntries(
        userRatings.map((r) => [r.proposalId.toString(), r.rating]),
      );

      const result = proposals
        .map((p) => {
          const agg = ratings.get(p._id.toString());
          return {
            id: p._id.toString(),
            title: p.title,
            problem: p.problem || "",
            solution: p.solution || "",
            averageRating: agg?.averageRating || 0,
            ratingCount: agg?.ratingCount || 0,
            userRating: userRatingMap[p._id.toString()] || 0,
          };
        })
        .sort(
          (a, b) =>
            b.averageRating - a.averageRating || b.ratingCount - a.ratingCount,
        );

      return res.status(200).json(result);
    } catch (error) {
      log.error("Failed to fetch mobile proposals", { error: error.message });
      return res.status(500).json({ message: "Failed to fetch proposals" });
    }
  }

  if (req.method === "POST") {
    try {
      const { title, problem, solution } = req.body;
      if (!title?.trim()) {
        return res.status(400).json({ message: "Titel krävs" });
      }

      const proposal = await Proposal.create({
        sessionId,
        title: title.trim(),
        problem: problem?.trim() || "",
        solution: solution?.trim() || "",
        authorId: user.id,
        status: "active",
      });

      return res.status(201).json({
        id: proposal._id.toString(),
        title: proposal.title,
        problem: proposal.problem,
        solution: proposal.solution,
        averageRating: 0,
        ratingCount: 0,
      });
    } catch (error) {
      log.error("Failed to create mobile proposal", { error: error.message });
      return res.status(500).json({ message: "Failed to create proposal" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
