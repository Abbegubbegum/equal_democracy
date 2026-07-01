import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../lib/mongodb";
import { QuickVote, Session } from "../../../lib/models";
import { verifyBearerToken } from "../../../lib/mobile-jwt";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MobileQuickVote");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { sessionId, choice } = req.body;
  if (!sessionId) return res.status(400).json({ message: "sessionId krävs" });
  if (!["ja", "nej"].includes(choice))
    return res.status(400).json({ message: "Ogiltigt val" });

  try {
    await connectDB();

    const existingVote = await QuickVote.findOne({
      sessionId,
      userId: user.id,
    }).lean();

    if (!existingVote) {
      const session: any = await Session.findById(sessionId)
        .select("status")
        .lean();
      if (!session || session.status !== "active") {
        return res
          .status(403)
          .json({ message: "Den här frågan är stängd för röstning." });
      }

      const PRE_ELECTION_LIMIT = 5;
      const used = await QuickVote.countDocuments({ userId: user.id });
      if (used >= PRE_ELECTION_LIMIT) {
        return res.status(403).json({
          message:
            "Du har röstat i 5 frågor — det är din kvot fram till valet den 13 september.",
        });
      }
    }

    await QuickVote.findOneAndUpdate(
      { sessionId, userId: user.id },
      { choice },
      { upsert: true, new: true },
    );

    const allVotes = await QuickVote.find({ sessionId }).lean();
    return res.status(200).json({
      voteCounts: {
        ja: allVotes.filter((v) => v.choice === "ja").length,
        nej: allVotes.filter((v) => v.choice === "nej").length,
      },
      userVote: choice,
    });
  } catch (error) {
    log.error("Failed to save quick vote", { error: error.message });
    return res.status(500).json({ message: "Röstning misslyckades" });
  }
}
