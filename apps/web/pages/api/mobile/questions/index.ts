import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Question, QuestionVote } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileQuestions");

const PRE_ELECTION_LIMIT = 5;

// Closed questions are only reachable on Rösta (a question the user selected or
// voted in that has since closed), so the tail doesn't need to be unbounded —
// without a cap this payload grows forever as questions accumulate.
const CLOSED_QUESTION_LIMIT = 100;

const QUESTION_FIELDS =
  "_id text imageUrl deadline createdAt status categories";

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
        .select(QUESTION_FIELDS)
        .sort({ createdAt: -1 })
        .lean(),
      Question.find({ status: "closed" })
        .select(QUESTION_FIELDS)
        .sort({ createdAt: -1 })
        .limit(CLOSED_QUESTION_LIMIT)
        .lean(),
      QuestionVote.countDocuments({ userId: user.id }),
    ]);
    const quota = { used, limit: PRE_ELECTION_LIMIT };

    const allQuestions = [...activeQuestions, ...pastQuestions];
    if (allQuestions.length === 0)
      return res.status(200).json({ questions: [], quota });

    const questionIds = allQuestions.map((q) => q._id);
    // Tally ja/nej in the database rather than pulling every vote document
    // into the lambda and counting them in JS — this returns one row per
    // question instead of one per vote.
    const [tallies, userVotes] = await Promise.all([
      QuestionVote.aggregate([
        { $match: { questionId: { $in: questionIds } } },
        {
          $group: {
            _id: "$questionId",
            ja: { $sum: { $cond: [{ $eq: ["$choice", "ja"] }, 1, 0] } },
            nej: { $sum: { $cond: [{ $eq: ["$choice", "nej"] }, 1, 0] } },
          },
        },
      ]),
      QuestionVote.find({
        questionId: { $in: questionIds },
        userId: user.id,
      })
        .select("questionId choice")
        .lean(),
    ]);

    const tallyMap = new Map<string, { ja: number; nej: number }>(
      tallies.map((t) => [t._id.toString(), { ja: t.ja, nej: t.nej }]),
    );
    const userVoteMap = new Map<string, string>(
      userVotes.map((v) => [v.questionId.toString(), v.choice]),
    );

    const result = allQuestions.map((q) => {
      const qid = q._id.toString();
      return {
        id: qid,
        text: q.text,
        imageUrl: (q as any).imageUrl ?? null,
        isActive: q.status === "active",
        deadline: q.deadline,
        categories: (q as any).categories ?? [],
        voteCounts: tallyMap.get(qid) ?? { ja: 0, nej: 0 },
        createdAt: q.createdAt,
        userVote: userVoteMap.get(qid) ?? null,
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
