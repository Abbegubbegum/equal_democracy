import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Question, QuestionComment, QuestionCommentRating } from "@/lib/models";
import { csrfProtection } from "@/lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("QuestionCommentRate");

/**
 * POST /api/questions/comments/rate
 * Web (NextAuth session) equivalent of /api/mobile/questions/comments/rate —
 * upsert a 1-5 star rating on a debate comment. Shares QuestionCommentRating
 * with mobile.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id)
    return res.status(401).json({ message: "Unauthorized" });
  if (!csrfProtection(req, res)) return;

  const userId = session.user.id;
  const { commentId, rating } = req.body;
  if (!commentId || !rating)
    return res.status(400).json({ message: "commentId och rating krävs" });
  if (typeof rating !== "number" || rating < 1 || rating > 5)
    return res
      .status(400)
      .json({ message: "rating måste vara mellan 1 och 5" });

  try {
    await connectDB();

    const comment: any = await QuestionComment.findById(commentId).lean();
    if (!comment)
      return res.status(404).json({ message: "Kommentaren hittades inte" });

    const question: any = await Question.findById(comment.questionId)
      .select("status")
      .lean();
    if (!question || question.status !== "active") {
      return res
        .status(403)
        .json({ message: "Debatten är stängd för den här frågan." });
    }

    await QuestionCommentRating.findOneAndUpdate(
      { commentId, userId },
      { rating },
      { upsert: true },
    );

    const ratings = await QuestionCommentRating.find({ commentId }).lean();
    const averageRating =
      ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    return res.status(200).json({
      averageRating,
      userRating: rating,
      totalRatings: ratings.length,
    });
  } catch (error) {
    log.error("Failed to rate question comment", {
      error: (error as Error).message,
    });
    return res
      .status(500)
      .json({ message: "Det gick inte att betygsätta kommentaren" });
  }
}
