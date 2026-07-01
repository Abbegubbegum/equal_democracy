import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Session, QuickVote } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileVotingSession");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await connectDB();

    const PRE_ELECTION_LIMIT = 5;
    const [activeSessions, pastSessions, used] = await Promise.all([
      Session.find({ status: "active", sessionType: "voting" })
        .select("_id place imageUrl startDate createdAt status categories")
        .sort({ createdAt: -1 })
        .lean(),
      Session.find({
        status: { $in: ["closed", "archived"] },
        sessionType: "voting",
      })
        .select("_id place imageUrl startDate createdAt status categories")
        .sort({ createdAt: -1 })
        .lean(),
      QuickVote.countDocuments({ userId: user.id }),
    ]);
    const quota = { used, limit: PRE_ELECTION_LIMIT };

    const allSessions = [...activeSessions, ...pastSessions];
    if (allSessions.length === 0)
      return res.status(200).json({ sessions: [], quota });

    const sessionIds = allSessions.map((s) => s._id);
    const [allVotes, userVotes] = await Promise.all([
      QuickVote.find({ sessionId: { $in: sessionIds } }).lean(),
      QuickVote.find({
        sessionId: { $in: sessionIds },
        userId: user.id,
      }).lean(),
    ]);

    const userVoteMap = Object.fromEntries(
      userVotes.map((v) => [v.sessionId.toString(), v.choice]),
    );

    const result = allSessions.map((s) => {
      const sid = s._id.toString();
      const votes = allVotes.filter((v) => v.sessionId.toString() === sid);
      return {
        id: sid,
        question: s.place,
        imageUrl: (s as any).imageUrl ?? null,
        isActive: s.status === "active",
        startDate: s.startDate,
        categories: (s as any).categories ?? [],
        voteCounts: {
          ja: votes.filter((v) => v.choice === "ja").length,
          nej: votes.filter((v) => v.choice === "nej").length,
        },
        createdAt: s.createdAt,
        userVote: userVoteMap[sid] ?? null,
      };
    });

    return res.status(200).json({ sessions: result, quota });
  } catch (error) {
    log.error("Failed to fetch voting sessions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch voting sessions" });
  }
}
