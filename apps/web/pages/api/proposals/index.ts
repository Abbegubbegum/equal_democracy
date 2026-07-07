import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Proposal, ProposalRating, Comment } from "../../../lib/models";
import {
  getActiveSession,
  registerActiveUser,
} from "../../../lib/session-helper";
import { csrfProtection } from "../../../lib/csrf";
import { hasAdminAccess } from "../../../lib/admin-helper";
import { getRatingAggregates } from "../../../lib/rating-helper";
import broadcaster from "../../../lib/pusher-broadcaster";
import { createLogger } from "../../../lib/logger";

const log = createLogger("Proposals");

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
    try {
      // Get authentication session
      const session = await getServerSession(req, res, authOptions);
      const currentUserId = session?.user?.id;

      // Get sessionId from query parameter (optional for backward compatibility)
      const { sessionId } = req.query;

      // Get the active session (with optional sessionId)
      const activeSession = await getActiveSession(
        sessionId ? String(sessionId) : null,
      );

      // If no active session, return empty array
      if (!activeSession) {
        return res.status(200).json([]);
      }

      // Only get proposals from the active session
      const proposals = await Proposal.find({
        sessionId: activeSession._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      const proposalIds = proposals.map((p) => p._id);
      const ratings = await getRatingAggregates(
        ProposalRating,
        "proposalId",
        proposalIds,
      );
      const commentCounts = await Comment.aggregate([
        { $match: { proposalId: { $in: proposalIds } } },
        { $group: { _id: "$proposalId", count: { $sum: 1 } } },
      ]);
      const commentCountMap = new Map(
        commentCounts.map((c) => [c._id.toString(), c.count]),
      );

      const proposalsWithCounts = proposals.map((proposal) => {
        const agg = ratings.get(proposal._id.toString());

        // Only include authorId if this is the user's own proposal
        const isOwnProposal =
          currentUserId && proposal.authorId.toString() === currentUserId;

        return {
          ...proposal,
          _id: proposal._id.toString(),
          authorId: isOwnProposal ? proposal.authorId.toString() : undefined,
          averageRating: agg?.averageRating || 0,
          ratingCount: agg?.ratingCount || 0,
          commentsCount: commentCountMap.get(proposal._id.toString()) || 0,
        };
      });

      return res.status(200).json(proposalsWithCounts);
    } catch (error) {
      log.error("Failed to fetch proposals", { error: error.message });
      return res.status(500).json({ message: "An error has occured" });
    }
  }

  if (req.method === "POST") {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ message: "You have to be logged in" });
    }

    const { title, problem, solution, sessionId } = req.body;

    try {
      // Get the active session (with optional sessionId)
      const activeSession = await getActiveSession(
        sessionId ? String(sessionId) : null,
      );

      // If no active session, cannot create proposal
      if (!activeSession) {
        return res.status(400).json({ message: "No active session exists" });
      }

      // Validate fields based on noMotivation setting
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      // Only require problem and solution if noMotivation is false
      if (!activeSession.noMotivation && (!problem || !solution)) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if session has maxOneProposalPerUser enabled
      // Admins are exempt to allow manual entry of paper proposals
      if (
        activeSession.maxOneProposalPerUser &&
        !hasAdminAccess(session.user)
      ) {
        // Check if user already has a proposal in this session
        const userProposalCount = await Proposal.countDocuments({
          sessionId: activeSession._id,
          authorId: session.user.id,
          status: { $in: ["active", "finalist"] },
        });

        if (userProposalCount > 0) {
          return res.status(400).json({
            message: "You have already submitted a proposal in this session.",
          });
        }
      }

      // Check if transition is scheduled - block new proposals during countdown
      if (activeSession.phase1TransitionScheduled) {
        return res.status(400).json({
          message:
            "Cannot create new proposals - phase transition is scheduled",
        });
      }

      // Check for duplicate proposal title in current session
      const existingProposal = await Proposal.findOne({
        sessionId: activeSession._id,
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
        status: { $in: ["active", "finalist"] },
      });

      if (existingProposal) {
        return res.status(400).json({
          message:
            "A proposal with this title already exists, please pick a new title.",
        });
      }

      const proposal = await Proposal.create({
        sessionId: activeSession._id,
        title,
        problem,
        solution,
        authorId: session.user.id,
        status: "active",
      });

      // Register user as active in session
      await registerActiveUser(session.user.id, activeSession._id.toString());

      // Broadcast new proposal event to all connected clients
      // Note: authorId removed for anonymity
      await broadcaster.broadcast("new-proposal", {
        _id: proposal._id.toString(),
        sessionId: proposal.sessionId.toString(),
        title: proposal.title,
        problem: proposal.problem,
        solution: proposal.solution,
        status: proposal.status,
        ratingCount: 0,
        averageRating: 0,
        yesVotes: 0,
        noVotes: 0,
        createdAt: proposal.createdAt,
        commentsCount: 0,
      });

      return res.status(201).json({
        ...proposal.toObject(),
        _id: proposal._id.toString(),
        authorId: proposal.authorId.toString(),
      });
    } catch (error) {
      log.error("Failed to create proposal", { error: error.message });
      return res.status(500).json({
        message: "An error occurred while creating proposals",
      });
    }
  }

  if (req.method === "PATCH") {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ message: "You have to be logged in" });
    }

    const { action, proposalIds } = req.body;

    if (
      action === "moveToFinalist" &&
      proposalIds &&
      Array.isArray(proposalIds)
    ) {
      try {
        await Proposal.updateMany(
          { _id: { $in: proposalIds } },
          { $set: { status: "finalist" } },
        );

        return res.status(200).json({ message: "Finalists updated" });
      } catch (error) {
        log.error("Failed to update proposal", { error: error.message });
        return res.status(500).json({ message: "An error has occured" });
      }
    }

    return res.status(400).json({ message: "Bad request" });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
