import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../../lib/mongodb";
import {
  Question,
  QuestionComment,
  QuestionCommentRating,
} from "../../../../../lib/models";
import { getRatingAggregates } from "../../../../../lib/rating-helper";
import { verifyBearerToken } from "../../../../../lib/mobile-jwt";
import { createLogger } from "../../../../../lib/logger";

const log = createLogger("MobileQuestionComments");

/**
 * GET/POST /api/mobile/questions/comments?questionId=
 * För/emot discussion on a Question, backing the mobile Rösta debate section.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await connectDB();

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
        userId: user.id,
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
            isOwn: c.userId.toString() === user.id,
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
        userId: user.id,
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

  return res.status(405).json({ message: "Method not allowed" });
}
