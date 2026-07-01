import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../lib/mongodb";
import { Comment, CommentRating, Session } from "../../../lib/models";
import { verifyBearerToken } from "../../../lib/mobile-jwt";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MobileVotingComments");

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
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ message: "sessionId krävs" });

    try {
      const comments = await Comment.find({ sessionId })
        .sort({ averageRating: -1, createdAt: -1 })
        .lean();

      const ratings = await CommentRating.find({
        commentId: { $in: comments.map((c) => c._id) },
        userId: user.id,
      }).lean();
      const ratingByComment = new Map(
        ratings.map((r) => [r.commentId.toString(), r.rating]),
      );

      return res.status(200).json(
        comments.map((c) => ({
          _id: c._id.toString(),
          text: c.text,
          type: c.type || "neutral",
          averageRating: c.averageRating || 0,
          createdAt: c.createdAt,
          isOwn: c.userId.toString() === user.id,
          userRating: ratingByComment.get(c._id.toString()) ?? 0,
        })),
      );
    } catch (error) {
      log.error("Failed to fetch voting comments", {
        error: (error as Error).message,
      });
      return res.status(500).json({ message: "An error has occured" });
    }
  }

  if (req.method === "POST") {
    const { sessionId, text, type } = req.body;
    if (!sessionId || !text)
      return res.status(400).json({ message: "sessionId och text krävs" });
    if (text.length > 1000)
      return res
        .status(400)
        .json({ message: "Kommentaren är för lång (max 1000 tecken)" });
    if (type && !["for", "against", "neutral"].includes(type))
      return res.status(400).json({ message: "Ogiltig kommentartyp" });

    try {
      const session: any = await Session.findById(sessionId)
        .select("sessionType status")
        .lean();
      if (!session || session.sessionType !== "voting") {
        return res.status(400).json({ message: "Ogiltig fråga" });
      }
      if (session.status !== "active") {
        return res
          .status(403)
          .json({ message: "Debatten är stängd för den här frågan." });
      }

      const comment = await Comment.create({
        sessionId,
        userId: user.id,
        authorName: user.name,
        text,
        type: type || "neutral",
      });

      return res.status(201).json({
        _id: comment._id.toString(),
        text: comment.text,
        type: comment.type,
        averageRating: comment.averageRating || 0,
        createdAt: comment.createdAt,
        isOwn: true,
        userRating: 0,
      });
    } catch (error) {
      log.error("Failed to create voting comment", {
        error: (error as Error).message,
      });
      return res
        .status(500)
        .json({ message: "Det gick inte att posta kommentaren" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
