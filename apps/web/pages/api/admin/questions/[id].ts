import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Question } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess, isSuperAdmin } from "@/lib/admin-helper";
import { createLogger } from "@/lib/logger";
import { ALL_CATEGORIES } from "@repo/types";

const log = createLogger("AdminQuestionDetail");

/**
 * PATCH /api/admin/questions/[id] — edit a question's text/deadline/image/categories.
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

  const { id } = req.query;

  if (req.method === "PATCH") {
    try {
      const question = await Question.findById(id);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (
        !isSuperAdmin(session.user) &&
        question.createdBy?.toString() !== session.user.id
      ) {
        return res.status(403).json({
          error: "You can only edit questions that you created",
        });
      }

      const { text, deadline, imageUrl, categories: rawCategories } = req.body;

      if (text !== undefined) {
        if (!text.trim()) {
          return res.status(400).json({ error: "Question text is required" });
        }
        if (text.trim().length > 300) {
          return res
            .status(400)
            .json({ error: "Question text cannot exceed 300 characters" });
        }
        question.text = text.trim();
      }

      if (deadline !== undefined) {
        const deadlineDate = new Date(deadline);
        deadlineDate.setHours(23, 59, 59, 999);
        if (Number.isNaN(deadlineDate.getTime())) {
          return res.status(400).json({ error: "Invalid deadline" });
        }
        question.deadline = deadlineDate;
      }

      if (imageUrl !== undefined) {
        question.imageUrl = imageUrl || null;
      }

      if (rawCategories !== undefined) {
        question.categories = Array.isArray(rawCategories)
          ? (rawCategories as unknown[])
              .filter(
                (c): c is string =>
                  typeof c === "string" &&
                  (ALL_CATEGORIES as readonly string[]).includes(c),
              )
              .slice(0, 3)
          : [];
      }

      await question.save();

      return res.status(200).json({
        ...question.toObject(),
        _id: question._id.toString(),
      });
    } catch (error) {
      log.error("Failed to update question", { error: error.message });
      return res.status(500).json({ error: "Failed to update question" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
