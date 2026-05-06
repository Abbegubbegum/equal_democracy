import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Session, Proposal, FinalVote } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobilePhase2");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await connectDB();

    const sessions = await Session.find({
      status: "active",
      phase: "phase2",
      sessionType: { $nin: ["municipal", "voting"] },
    })
      .select("_id place startDate onlyYesVotes imageUrl")
      .sort({ startDate: -1 })
      .lean();

    const result = await Promise.all(
      sessions.map(async (session) => {
        const proposals = await Proposal.find({ sessionId: session._id, status: "active" })
          .select("_id title")
          .lean();

        const proposalIds = proposals.map((p) => p._id);

        const allVotes = await FinalVote.find({
          proposalId: { $in: proposalIds },
          sessionId: session._id,
        }).lean();

        const userVotes = await FinalVote.find({
          proposalId: { $in: proposalIds },
          userId: user.id,
        }).lean();
        const userVoteMap = Object.fromEntries(
          userVotes.map((v) => [v.proposalId.toString(), v.choice])
        );

        return {
          id: session._id.toString(),
          place: session.place,
          startDate: session.startDate,
          onlyYesVotes: session.onlyYesVotes || false,
          imageUrl: session.imageUrl || null,
          proposals: proposals.map((p) => {
            const pid = p._id.toString();
            const votes = allVotes.filter((v) => v.proposalId.toString() === pid);
            return {
              id: pid,
              title: p.title,
              yesVotes: votes.filter((v) => v.choice === "yes").length,
              noVotes: votes.filter((v) => v.choice === "no").length,
              userVote: userVoteMap[pid] || null,
            };
          }),
        };
      })
    );

    return res.status(200).json(result);
  } catch (error) {
    log.error("Failed to fetch phase2 sessions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch sessions" });
  }
}
