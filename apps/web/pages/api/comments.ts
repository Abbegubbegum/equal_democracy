import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { Comment, CommentRating } from "../../lib/models";
import { getActiveSession, registerActiveUser } from "../../lib/session-helper";
import { getRatingAggregates } from "../../lib/rating-helper";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/pusher-broadcaster";
import { createLogger } from "../../lib/logger";

const log = createLogger("Comments");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await connectDB();

  // CSRF protection for state-changing methods
  if (!csrfProtection(req, res)) {
    return;
  }

  if (req.method === "GET") {
    const { proposalId } = req.query;

    if (!proposalId) {
      return res.status(400).json({ message: "Proposal ID is required" });
    }

    try {
      // Get authentication session
      const session = await getServerSession(req, res, authOptions);
      const currentUserId = session?.user?.id;

      const comments = await Comment.find({ proposalId }).lean();
      const ratings = await getRatingAggregates(
        CommentRating,
        "commentId",
        comments.map((c) => c._id),
      );

      // Return comments with author info only for own comments, sorted by
      // rating first (computed at read time), then by creation date
      const anonymizedComments = comments
        .map((comment) => {
          const isOwnComment =
            currentUserId && comment.userId.toString() === currentUserId;
          const agg = ratings.get(comment._id.toString());

          return {
            _id: comment._id.toString(),
            proposalId: comment.proposalId.toString(),
            isOwn: isOwnComment, // Flag to identify user's own comments
            text: comment.text,
            type: comment.type || "neutral",
            averageRating: agg?.averageRating || 0,
            ratingCount: agg?.ratingCount || 0,
            createdAt: comment.createdAt,
          };
        })
        .sort(
          (a, b) =>
            b.averageRating - a.averageRating ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      return res.status(200).json(anonymizedComments);
    } catch (error) {
      log.error("Failed to fetch comments", { error: error.message });
      return res.status(500).json({ message: "An error has occured" });
    }
  }

  if (req.method === "POST") {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ message: "You have to be logged in" });
    }

    const { proposalId, text, type, sessionId } = req.body;

    if (!proposalId || !text) {
      return res
        .status(400)
        .json({ message: "Proposal ID and text is required" });
    }

    if (text.length > 1000) {
      return res
        .status(400)
        .json({ message: "Comment is too long (max 1000 characters)" });
    }

    // Validate type
    if (type && !["for", "against", "neutral"].includes(type)) {
      return res.status(400).json({ message: "Invalid comment type" });
    }

    try {
      // Get the active session (with optional sessionId)
      const activeSession = await getActiveSession(sessionId);

      // If no active session, cannot create comment
      if (!activeSession) {
        return res.status(400).json({ message: "No active session exists" });
      }

      const comment = await Comment.create({
        proposalId,
        userId: session.user.id,
        text,
        type: type || "neutral",
      });

      // Register user as active in session
      await registerActiveUser(session.user.id, activeSession._id.toString());

      // Broadcast new comment event (author identity removed for anonymity)
      await broadcaster.broadcast("new-comment", {
        _id: comment._id.toString(),
        proposalId: comment.proposalId.toString(),
        text: comment.text,
        type: comment.type,
        averageRating: 0,
        ratingCount: 0,
        createdAt: comment.createdAt,
      });

      return res.status(201).json({
        _id: comment._id.toString(),
        proposalId: comment.proposalId.toString(),
        isOwn: true, // This is the user's own comment
        text: comment.text,
        type: comment.type,
        averageRating: 0,
        ratingCount: 0,
        createdAt: comment.createdAt,
      });
    } catch (error) {
      log.error("Failed to create comment", { error: error.message });
      return res
        .status(500)
        .json({ message: "An error occurred while creating comments" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
