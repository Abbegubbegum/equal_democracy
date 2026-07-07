import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Question, QuestionComment, QuestionCommentRating } from "@/lib/models";
import { getRatingAggregates } from "@/lib/rating-helper";
import { csrfProtection } from "@/lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("QuestionComments");

/**
 * GET/POST /api/questions/comments?questionId=
 * Web (NextAuth session) equivalent of /api/mobile/questions/comments — the
 * för/emot debate on a Question, rating-sorted. Shares the QuestionComment
 * collection with mobile.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id)
    return res.status(401).json({ message: "Unauthorized" });

  await connectDB();
  const userId = session.user.id;

  if (req.method === "GET") {
    const { questionId } = req.query;
    if (!questionId)
      return res.status(400).json({ message: "questionId krävs" });

    try {
      const comments = await QuestionComment.find({ questionId }).lean();
      const ratings = await getRatingAggregates(
        QuestionCommentRating,
        "commentId",
        comments.map((c) => c._id),
      );
      const userRatings = await QuestionCommentRating.find({
        commentId: { $in: comments.map((c) => c._id) },
        userId,
      }).lean();
      const userRatingByComment = new Map(
        userRatings.map((r) => [r.commentId.toString(), r.rating]),
      );

      const result = comments
        .map((c) => {
          const agg = ratings.get(c._id.toString());
          return {
            _id: c._id.toString(),
            text: c.text,
            type: c.type || "neutral",
            averageRating: agg?.averageRating || 0,
            createdAt: c.createdAt,
            isOwn: c.userId.toString() === userId,
            userRating: userRatingByComment.get(c._id.toString()) ?? 0,
          };
        })
        .sort(
          (a, b) =>
            b.averageRating - a.averageRating ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      return res.status(200).json(result);
    } catch (error) {
      log.error("Failed to fetch question comments", {
        error: (error as Error).message,
      });
      return res.status(500).json({ message: "An error has occured" });
    }
  }

  if (req.method === "POST") {
    if (!csrfProtection(req, res)) return;

    const { questionId, text, type } = req.body;
    if (!questionId || !text)
      return res.status(400).json({ message: "questionId och text krävs" });
    if (text.length > 1000)
      return res
        .status(400)
        .json({ message: "Kommentaren är för lång (max 1000 tecken)" });
    if (type && !["for", "against", "neutral"].includes(type))
      return res.status(400).json({ message: "Ogiltig kommentartyp" });

    try {
      const question: any = await Question.findById(questionId)
        .select("status")
        .lean();
      if (!question) {
        return res.status(400).json({ message: "Ogiltig fråga" });
      }
      if (question.status !== "active") {
        return res
          .status(403)
          .json({ message: "Debatten är stängd för den här frågan." });
      }

      const comment = await QuestionComment.create({
        questionId,
        userId,
        text,
        type: type || "neutral",
      });

      return res.status(201).json({
        _id: comment._id.toString(),
        text: comment.text,
        type: comment.type,
        averageRating: 0,
        createdAt: comment.createdAt,
        isOwn: true,
        userRating: 0,
      });
    } catch (error) {
      log.error("Failed to create question comment", {
        error: (error as Error).message,
      });
      return res
        .status(500)
        .json({ message: "Det gick inte att posta kommentaren" });
    }
  }

  if (req.method === "PATCH") {
    if (!csrfProtection(req, res)) return;

    const { commentId, text } = req.body;
    if (!commentId || !text || typeof text !== "string" || !text.trim())
      return res.status(400).json({ message: "commentId och text krävs" });
    if (text.length > 1000)
      return res
        .status(400)
        .json({ message: "Kommentaren är för lång (max 1000 tecken)" });

    try {
      const comment: any = await QuestionComment.findById(commentId).lean();
      if (!comment)
        return res.status(404).json({ message: "Kommentaren hittades inte" });

      const isOwner = comment.userId.toString() === userId;
      const isAdmin = !!(session.user?.isAdmin || session.user?.isSuperAdmin);
      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ message: "Du får inte redigera det här inlägget." });
      }

      await QuestionComment.findByIdAndUpdate(commentId, {
        $set: { text: text.trim() },
      });
      return res.status(200).json({ ok: true });
    } catch (error) {
      log.error("Failed to edit question comment", {
        error: (error as Error).message,
      });
      return res
        .status(500)
        .json({ message: "Det gick inte att redigera kommentaren" });
    }
  }

  if (req.method === "DELETE") {
    if (!csrfProtection(req, res)) return;

    const commentId = req.body?.commentId || req.query?.commentId;
    if (!commentId) return res.status(400).json({ message: "commentId krävs" });

    try {
      const comment: any = await QuestionComment.findById(commentId).lean();
      if (!comment)
        return res.status(404).json({ message: "Kommentaren hittades inte" });

      const isOwner = comment.userId.toString() === userId;
      const isAdmin = !!(session.user?.isAdmin || session.user?.isSuperAdmin);
      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ message: "Du får inte ta bort det här inlägget." });
      }

      await QuestionComment.deleteOne({ _id: commentId });
      await QuestionCommentRating.deleteMany({ commentId });
      return res.status(200).json({ ok: true });
    } catch (error) {
      log.error("Failed to delete question comment", {
        error: (error as Error).message,
      });
      return res
        .status(500)
        .json({ message: "Det gick inte att ta bort kommentaren" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
