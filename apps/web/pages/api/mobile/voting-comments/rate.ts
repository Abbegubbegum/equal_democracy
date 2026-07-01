import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Comment, CommentRating, Session } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileVotingCommentRate");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { commentId, rating } = req.body;
  if (!commentId || !rating)
    return res.status(400).json({ message: "commentId och rating krävs" });
  if (typeof rating !== "number" || rating < 1 || rating > 5)
    return res
      .status(400)
      .json({ message: "rating måste vara mellan 1 och 5" });

  try {
    await connectDB();

    const comment: any = await Comment.findById(commentId);
    if (!comment)
      return res.status(404).json({ message: "Kommentaren hittades inte" });

    const session: any = await Session.findById(comment.sessionId)
      .select("status")
      .lean();
    if (!session || session.status !== "active") {
      return res
        .status(403)
        .json({ message: "Debatten är stängd för den här frågan." });
    }

    await CommentRating.findOneAndUpdate(
      { commentId, userId: user.id },
      { sessionId: comment.sessionId, rating },
      { upsert: true },
    );

    const ratings = await CommentRating.find({ commentId }).lean();
    const averageRating =
      ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    comment.averageRating = averageRating;
    await comment.save();

    return res.status(200).json({
      averageRating,
      userRating: rating,
      totalRatings: ratings.length,
    });
  } catch (error) {
    log.error("Failed to rate voting comment", {
      error: (error as Error).message,
    });
    return res
      .status(500)
      .json({ message: "Det gick inte att betygsätta kommentaren" });
  }
}
