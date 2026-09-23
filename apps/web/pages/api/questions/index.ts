import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Question, QuestionVote } from "@/lib/models";
import { createLogger } from "@/lib/logger";
import { quotaState } from "@/lib/vote-quota";
import { CLOSED_QUESTION_LIMIT, byTurnout } from "@/lib/question-feed";

const log = createLogger("Questions");

const QUESTION_FIELDS =
  "_id text imageUrl deadline createdAt status categories closedAt";

/**
 * GET /api/questions
 * Web (NextAuth session) equivalent of /api/mobile/questions — active
 * questions first (most-voted first, i.e. by total ja+nej count descending,
 * newest as tie-break), then closed questions newest-closed-first (capped at
 * CLOSED_QUESTION_LIMIT). Each entry carries per-question vote counts + the
 * viewer's own vote (closed questions never carry one — see
 * lib/vote-anonymisation.ts), plus the 5-vote pre-election quota. Backs the
 * web Hem feed (including its closed-question fallback once the active feed
 * is empty) and the Arkiv page's Hem tab.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  // Public: / and /rosta are readable signed out — the questions and the
  // running tallies are the point of the page. Only the caller's own vote and
  // quota need an account, and both are simply absent without one.
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id ?? null;

  try {
    await connectDB();

    const [activeQuestions, pastQuestions, quota] = await Promise.all([
      Question.find({ status: "active" })
        .select(QUESTION_FIELDS)
        .sort({ createdAt: -1 })
        .lean(),
      // closedAt first, not createdAt — a question's creation date is not
      // when it closed (deadlines and manual closes both make that gap vary).
      Question.find({ status: "closed" })
        .select(QUESTION_FIELDS)
        .sort({ closedAt: -1, createdAt: -1 })
        .limit(CLOSED_QUESTION_LIMIT)
        .lean(),
      // Null rather than "0 of 5" for a signed-out reader: an unused quota
      // reads as an invitation, and they cannot vote at all.
      userId ? quotaState(userId) : null,
    ]);

    const allQuestions = [...activeQuestions, ...pastQuestions];
    if (allQuestions.length === 0)
      return res.status(200).json({ questions: [], quota });

    const questionIds = allQuestions.map((q) => q._id);
    // Tally ja/nej in the database rather than pulling every vote document
    // into the lambda and counting them in JS — this returns one row per
    // question instead of one per vote (this endpoint used to do the latter).
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
      userId
        ? QuestionVote.find({ questionId: { $in: questionIds }, userId })
            .select("questionId choice")
            .lean()
        : [],
    ]);

    const tallyMap = new Map<string, { ja: number; nej: number }>(
      tallies.map((t) => [t._id.toString(), { ja: t.ja, nej: t.nej }]),
    );
    const userVoteMap = new Map<string, string>(
      userVotes.map((v): [string, string] => [
        v.questionId.toString(),
        v.choice,
      ]),
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
        closedAt: (q as any).closedAt ?? null,
        userVote: userVoteMap.get(qid) ?? null,
      };
    });

    // Active questions ordered by turnout (most people voted first), newest as
    // tie-break; closed questions stay newest-closed-first below them.
    const active = result.filter((q) => q.isActive).sort(byTurnout);
    const past = result.filter((q) => !q.isActive);

    return res.status(200).json({ questions: [...active, ...past], quota });
  } catch (error) {
    log.error("Failed to fetch questions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch questions" });
  }
}
