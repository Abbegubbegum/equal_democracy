import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Question, QuestionVote } from "@/lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("Questions");

const PRE_ELECTION_LIMIT = 5;

/**
 * GET /api/questions
 * Web (NextAuth session) equivalent of /api/mobile/questions — the active
 * Ja/Nej questions with per-question vote counts + the viewer's own vote, plus
 * the 5-vote pre-election quota. Backs the web Hem feed.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id)
    return res.status(401).json({ message: "Unauthorized" });

  try {
    await connectDB();
    const userId = session.user.id;

    const [activeQuestions, used] = await Promise.all([
      Question.find({ status: "active" })
        .select("_id text imageUrl deadline createdAt status categories")
        .sort({ createdAt: -1 })
        .lean(),
      QuestionVote.countDocuments({ userId }),
    ]);
    const quota = { used, limit: PRE_ELECTION_LIMIT };

    if (activeQuestions.length === 0)
      return res.status(200).json({ questions: [], quota });

    const questionIds = activeQuestions.map((q) => q._id);
    const [allVotes, userVotes] = await Promise.all([
      QuestionVote.find({ questionId: { $in: questionIds } }).lean(),
      QuestionVote.find({ questionId: { $in: questionIds }, userId }).lean(),
    ]);
    const userVoteMap = Object.fromEntries(
      userVotes.map((v) => [v.questionId.toString(), v.choice]),
    );

    const questions = activeQuestions.map((q) => {
      const qid = q._id.toString();
      const votes = allVotes.filter((v) => v.questionId.toString() === qid);
      return {
        id: qid,
        text: q.text,
        imageUrl: (q as any).imageUrl ?? null,
        deadline: q.deadline,
        categories: (q as any).categories ?? [],
        voteCounts: {
          ja: votes.filter((v) => v.choice === "ja").length,
          nej: votes.filter((v) => v.choice === "nej").length,
        },
        createdAt: q.createdAt,
        userVote: userVoteMap[qid] ?? null,
      };
    });

    return res.status(200).json({ questions, quota });
  } catch (error) {
    log.error("Failed to fetch questions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch questions" });
  }
}
