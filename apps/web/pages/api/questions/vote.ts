import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Question, QuestionVote } from "@/lib/models";
import { csrfProtection } from "@/lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("QuestionVote");

const PRE_ELECTION_LIMIT = 5;

/**
 * POST /api/questions/vote
 * Web (NextAuth session) equivalent of /api/mobile/questions/vote. A brand-new
 * vote is gated by the question being active and the 5-vote pre-election quota;
 * changing an existing vote is always free. Shares the QuestionVote collection
 * with mobile — one source of truth.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id)
    return res.status(401).json({ message: "Unauthorized" });
  if (!csrfProtection(req, res)) return;

  const userId = session.user.id;
  const { questionId, choice } = req.body;
  if (!questionId) return res.status(400).json({ message: "questionId krävs" });
  if (!["ja", "nej"].includes(choice))
    return res.status(400).json({ message: "Ogiltigt val" });

  try {
    await connectDB();

    const existingVote = await QuestionVote.findOne({
      questionId,
      userId,
    }).lean();

    if (!existingVote) {
      const question: any = await Question.findById(questionId)
        .select("status")
        .lean();
      if (!question || question.status !== "active") {
        return res
          .status(403)
          .json({ message: "Den här frågan är stängd för röstning." });
      }

      const used = await QuestionVote.countDocuments({ userId });
      if (used >= PRE_ELECTION_LIMIT) {
        return res.status(403).json({
          message:
            "Du har röstat i 5 frågor — det är din kvot fram till valet den 13 september.",
        });
      }
    }

    await QuestionVote.findOneAndUpdate(
      { questionId, userId },
      { choice },
      { upsert: true, new: true },
    );

    const allVotes = await QuestionVote.find({ questionId }).lean();
    return res.status(200).json({
      voteCounts: {
        ja: allVotes.filter((v) => v.choice === "ja").length,
        nej: allVotes.filter((v) => v.choice === "nej").length,
      },
      userVote: choice,
    });
  } catch (error) {
    log.error("Failed to save question vote", { error: error.message });
    return res.status(500).json({ message: "Röstning misslyckades" });
  }
}
