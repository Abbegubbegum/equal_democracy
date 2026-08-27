import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Question, QuestionVote } from "@/lib/models";
import { createLogger } from "@/lib/logger";
import { PRE_ELECTION_LIMIT } from "@/lib/vote-quota";

const log = createLogger("Questions");

/** Sort by total turnout (ja+nej) descending, newest as tie-break. */
function byTurnout(
  a: { voteCounts: { ja: number; nej: number }; createdAt: Date },
  b: { voteCounts: { ja: number; nej: number }; createdAt: Date },
) {
  const at = a.voteCounts.ja + a.voteCounts.nej;
  const bt = b.voteCounts.ja + b.voteCounts.nej;
  if (bt !== at) return bt - at;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * GET /api/questions
 * Web (NextAuth session) equivalent of /api/mobile/questions — the active
 * Ja/Nej questions with per-question vote counts + the viewer's own vote, plus
 * the 5-vote pre-election quota. Ordered by turnout (most people voted first).
 * Backs the web Hem feed.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  // Public: /rosta is readable signed out — the questions and the running
  // tallies are the point of the page. Only the caller's own vote and quota
  // need an account, and both are simply absent without one.
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id ?? null;

  try {
    await connectDB();

    const [activeQuestions, used] = await Promise.all([
      Question.find({ status: "active" })
        .select("_id text imageUrl deadline createdAt status categories")
        .sort({ createdAt: -1 })
        .lean(),
      userId ? QuestionVote.countDocuments({ userId }) : 0,
    ]);
    // Null rather than "0 of 5" for a signed-out reader: an unused quota reads
    // as an invitation, and they cannot vote at all.
    const quota = userId ? { used, limit: PRE_ELECTION_LIMIT } : null;

    if (activeQuestions.length === 0)
      return res.status(200).json({ questions: [], quota });

    const questionIds = activeQuestions.map((q) => q._id);
    const [allVotes, userVotes] = await Promise.all([
      QuestionVote.find({ questionId: { $in: questionIds } }).lean(),
      userId
        ? QuestionVote.find({
            questionId: { $in: questionIds },
            userId,
          }).lean()
        : [],
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

    questions.sort(byTurnout);

    return res.status(200).json({ questions, quota });
  } catch (error) {
    log.error("Failed to fetch questions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch questions" });
  }
}
