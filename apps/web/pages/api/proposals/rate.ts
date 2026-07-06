import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { ProposalRating } from "../../../lib/models";
import {
  getActiveSession,
  registerActiveUser,
} from "../../../lib/session-helper";
import { getRatingAggregates } from "../../../lib/rating-helper";
import { csrfProtection } from "../../../lib/csrf";
import broadcaster from "../../../lib/pusher-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("ProposalRating");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await connectDB();

  // CSRF protection for state-changing methods
  if (!csrfProtection(req, res)) {
    return;
  }

  if (req.method === "POST") {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ message: "You have to be logged in" });
    }

    const { proposalId, rating, sessionId } = req.body;

    if (!proposalId) {
      return res.status(400).json({ message: "Proposal ID is required" });
    }

    // Validate rating (1-5)
    if (rating && (rating < 1 || rating > 5)) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    try {
      // Get the active session (with optional sessionId)
      const activeSession = await getActiveSession(sessionId);

      // If no active session, cannot rate
      if (!activeSession) {
        return res.status(400).json({ message: "No active session exists" });
      }

      const existingVote = await ProposalRating.findOne({
        proposalId,
        userId: session.user.id,
      });

      if (existingVote) {
        existingVote.rating = rating || 5;
        await existingVote.save();
      } else {
        await ProposalRating.create({
          proposalId,
          userId: session.user.id,
          rating: rating || 5,
        });

        // Register user as active in session
        await registerActiveUser(session.user.id, activeSession._id.toString());
      }

      const agg = (
        await getRatingAggregates(ProposalRating, "proposalId", [proposalId])
      ).get(proposalId.toString()) || { averageRating: 0, ratingCount: 0 };

      // Broadcast rating update event
      await broadcaster.broadcast("rating-update", {
        sessionId: activeSession._id.toString(),
        proposalId: proposalId.toString(),
        ratingCount: agg.ratingCount,
        averageRating: agg.averageRating,
      });

      return res.status(existingVote ? 200 : 201).json({
        message: existingVote ? "Rating uppdated" : "Rating registered",
        count: agg.ratingCount,
        averageRating: agg.averageRating,
        userRating: rating || 5,
      });
    } catch (error) {
      log.error("Failed to rate proposal", {
        proposalId: req.body.proposalId,
        error: error.message,
      });
      return res.status(500).json({ message: "An error has occured" });
    }
  }

  if (req.method === "GET") {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ message: "You have to be logged in" });
    }

    const { proposalId } = req.query;

    if (proposalId) {
      const vote = await ProposalRating.findOne({
        proposalId,
        userId: session.user.id,
      });

      return res.status(200).json({
        voted: !!vote,
        rating: vote ? vote.rating : 0,
      });
    }

    const votes = await ProposalRating.find({ userId: session.user.id })
      .populate("proposalId")
      .lean();

    return res.status(200).json(votes);
  }

  return res.status(405).json({ message: "Method not allowed" });
}
