import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Question } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess, isSuperAdmin } from "@/lib/admin-helper";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminCloseQuestion");

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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ error: "Question ID is required" });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.status === "closed") {
      return res.status(400).json({ error: "Question is already closed" });
    }

    // Only the creator or a superadmin can close a question. Questions
    // spawned from a municipal meeting item are closed via
    // /api/municipal/close-item instead.
    if (
      !isSuperAdmin(session.user) &&
      question.createdBy?.toString() !== session.user.id
    ) {
      return res.status(403).json({
        error: "You can only close questions that you created",
      });
    }

    question.status = "closed";
    question.closedAt = new Date();
    await question.save();

    return res.status(200).json({
      message: "Question closed successfully",
      question,
    });
  } catch (error) {
    log.error("Failed to close question", {
      questionId: req.body?.questionId,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to close question" });
  }
}
