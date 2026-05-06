import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { CitizenProposal, CitizenProposalRating } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileCitizenRate");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { proposalId, rating } = req.body;
  if (!proposalId) return res.status(400).json({ message: "Missing proposalId" });
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1–5" });

  try {
    await connectDB();

    const existing = await CitizenProposalRating.findOne({ proposalId, userId: user.id });
    if (existing) {
      existing.rating = rating;
      await existing.save();
    } else {
      await CitizenProposalRating.create({ proposalId, userId: user.id, rating });
    }

    const all = await CitizenProposalRating.find({ proposalId });
    const totalStars = all.reduce((sum, r) => sum + r.rating, 0);
    const ratingCount = all.length;
    const averageRating = totalStars / ratingCount;

    await CitizenProposal.findByIdAndUpdate(proposalId, { totalStars, ratingCount, averageRating });

    return res.status(200).json({ averageRating, ratingCount, userRating: rating });
  } catch (error) {
    log.error("Failed to rate citizen proposal", { error: error.message });
    return res.status(500).json({ message: "Failed to rate" });
  }
}
