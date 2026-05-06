import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { ThumbsUp, Proposal } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileRate");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { proposalId, rating, sessionId } = req.body;

  if (!proposalId || !sessionId) return res.status(400).json({ message: "Missing proposalId or sessionId" });
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1–5" });

  try {
    await connectDB();

    const existing = await ThumbsUp.findOne({ proposalId, userId: user.id });
    if (existing) {
      existing.rating = rating;
      await existing.save();
    } else {
      await ThumbsUp.create({ sessionId, proposalId, userId: user.id, rating });
    }

    const all = await ThumbsUp.find({ proposalId });
    const averageRating = all.reduce((sum, r) => sum + r.rating, 0) / all.length;
    const thumbsUpCount = all.length;

    await Proposal.findByIdAndUpdate(proposalId, { thumbsUpCount, averageRating });

    return res.status(200).json({ averageRating, thumbsUpCount, userRating: rating });
  } catch (error) {
    log.error("Failed to rate proposal", { error: error.message });
    return res.status(500).json({ message: "Failed to rate" });
  }
}
