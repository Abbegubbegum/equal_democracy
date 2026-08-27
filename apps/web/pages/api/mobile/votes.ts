import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../lib/mongodb";
import { FinalVote } from "../../../lib/models";
import { requireParticipant } from "../../../lib/viewer";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MobileVote");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const viewer = await requireParticipant(req, res);
  if (!viewer) return;

  const { proposalId, sessionId, choice } = req.body;
  if (!proposalId || !sessionId)
    return res.status(400).json({ message: "Missing fields" });
  if (!["yes", "no"].includes(choice))
    return res.status(400).json({ message: "Choice must be yes or no" });

  try {
    await connectDB();

    const existing = await FinalVote.findOne({
      proposalId,
      userId: viewer.userId,
    });
    if (existing) {
      existing.choice = choice;
      await existing.save();
    } else {
      await FinalVote.create({
        sessionId,
        proposalId,
        userId: viewer.userId,
        choice,
      });
    }

    const allVotes = await FinalVote.find({ proposalId });
    return res.status(200).json({
      yesVotes: allVotes.filter((v) => v.choice === "yes").length,
      noVotes: allVotes.filter((v) => v.choice === "no").length,
      userVote: choice,
    });
  } catch (error) {
    log.error("Failed to submit vote", { error: error.message });
    return res.status(500).json({ message: "Failed to submit vote" });
  }
}
