import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Question, QuestionVote } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileQuestions");

const PRE_ELECTION_LIMIT = 5;

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
 * GET /api/mobile/questions
 * Returns { questions, quota } — active questions first (most-voted first, i.e.
 * by total ja+nej count descending, newest as tie-break), then closed/archived
 * newest-first. Backs the mobile Hem/Rösta tabs.
 */
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

    const [activeQuestions, pastQuestions, used] = await Promise.all([
      Question.find({ status: "active" })
        .select("_id text imageUrl deadline createdAt status categories")
        .sort({ createdAt: -1 })
        .lean(),
      Question.find({ status: "closed" })
        .select("_id text imageUrl deadline createdAt status categories")
        .sort({ createdAt: -1 })
        .lean(),
      QuestionVote.countDocuments({ userId: user.id }),
    ]);
    const quota = { used, limit: PRE_ELECTION_LIMIT };

    const allQuestions = [...activeQuestions, ...pastQuestions];
    if (allQuestions.length === 0)
      return res.status(200).json({ questions: [], quota });

    const questionIds = allQuestions.map((q) => q._id);
    const [allVotes, userVotes] = await Promise.all([
      QuestionVote.find({ questionId: { $in: questionIds } }).lean(),
      QuestionVote.find({
        questionId: { $in: questionIds },
        userId: user.id,
      }).lean(),
    ]);

    const userVoteMap = Object.fromEntries(
      userVotes.map((v) => [v.questionId.toString(), v.choice]),
    );

    const result = allQuestions.map((q) => {
      const qid = q._id.toString();
      const votes = allVotes.filter((v) => v.questionId.toString() === qid);
      return {
        id: qid,
        text: q.text,
        imageUrl: (q as any).imageUrl ?? null,
        isActive: q.status === "active",
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

    // Active questions ordered by turnout (most people voted first), newest as
    // tie-break; closed questions stay newest-first below them.
    const active = result.filter((q) => q.isActive).sort(byTurnout);
    const past = result.filter((q) => !q.isActive);

    return res.status(200).json({ questions: [...active, ...past], quota });
  } catch (error) {
    log.error("Failed to fetch questions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch questions" });
  }
}
