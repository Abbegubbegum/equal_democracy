import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Question, QuestionVote } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess, isSuperAdmin } from "@/lib/admin-helper";
import {
  notifyNewVotingQuestion,
  getTokensForCategories,
} from "@/lib/push-notifications";
import { createLogger } from "@/lib/logger";
import { ALL_CATEGORIES } from "@repo/types";

const log = createLogger("AdminQuestions");

/**
 * GET  /api/admin/questions — list standalone questions (created by admins,
 *      not spawned from a municipal meeting item), with live ja/nej counts.
 * POST /api/admin/questions — create a new standalone question.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await dbConnect();

  if (!csrfProtection(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !hasAdminAccess(session.user)) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const filter = isSuperAdmin(session.user)
        ? {}
        : { createdBy: session.user.id };

      const questions = await Question.find({ ...filter, meetingId: null })
        .sort({ createdAt: -1 })
        .lean();

      const activeIds = questions
        .filter((q) => q.status === "active")
        .map((q) => q._id);

      const counts = activeIds.length
        ? await QuestionVote.aggregate([
            { $match: { questionId: { $in: activeIds } } },
            {
              $group: {
                _id: { questionId: "$questionId", choice: "$choice" },
                count: { $sum: 1 },
              },
            },
          ])
        : [];

      const countsByQuestion = new Map<string, { ja: number; nej: number }>();
      for (const c of counts) {
        const key = c._id.questionId.toString();
        const entry = countsByQuestion.get(key) || { ja: 0, nej: 0 };
        entry[c._id.choice as "ja" | "nej"] = c.count;
        countsByQuestion.set(key, entry);
      }

      const withCounts = questions.map((q) => ({
        ...q,
        _id: q._id.toString(),
        voteCounts: countsByQuestion.get(q._id.toString()) || {
          ja: 0,
          nej: 0,
        },
      }));

      return res.status(200).json(withCounts);
    } catch (error) {
      log.error("Failed to fetch questions", { error: error.message });
      return res.status(500).json({ error: "Failed to fetch questions" });
    }
  }

  if (req.method === "POST") {
    try {
      const { text, deadline, imageUrl, categories: rawCategories } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Question text is required" });
      }
      if (text.trim().length > 300) {
        return res
          .status(400)
          .json({ error: "Question text cannot exceed 300 characters" });
      }
      if (!deadline) {
        return res.status(400).json({ error: "Deadline is required" });
      }

      const deadlineDate = new Date(deadline);
      deadlineDate.setHours(23, 59, 59, 999);
      if (Number.isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ error: "Invalid deadline" });
      }
      if (deadlineDate.getTime() <= Date.now()) {
        return res
          .status(400)
          .json({ error: "Deadline must be in the future" });
      }

      const categories = Array.isArray(rawCategories)
        ? (rawCategories as unknown[])
            .filter(
              (c): c is string =>
                typeof c === "string" &&
                (ALL_CATEGORIES as readonly string[]).includes(c),
            )
            .slice(0, 3)
        : [];

      const question = await Question.create({
        text: text.trim(),
        status: "active",
        deadline: deadlineDate,
        imageUrl: imageUrl || null,
        categories,
        createdBy: session.user.id,
      });

      // Send targeted push notification to the mobile app
      getTokensForCategories(categories)
        .then((tokens) => notifyNewVotingQuestion(question.text, tokens))
        .catch(() => {});

      return res.status(201).json({
        ...question.toObject(),
        _id: question._id.toString(),
      });
    } catch (error) {
      log.error("Failed to create question", { error: error.message });
      const isDev = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: isDev ? error.message : "Failed to create question",
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
