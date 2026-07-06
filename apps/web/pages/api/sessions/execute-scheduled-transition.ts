import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ProposalRating } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getRatingAggregates } from "@/lib/rating-helper";
import broadcaster from "@/lib/pusher-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("Sessions");

/**
 * Checks if a scheduled phase transition should be executed
 * Called periodically from frontend to check if 90 seconds have passed
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get sessionId from request body (optional for backward compatibility)
    const { sessionId } = req.body;
    const now = new Date();

    // Build query for session - add sessionId if provided
    const sessionQuery: Record<string, unknown> = {
      status: "active",
      phase: "phase1",
      phase1TransitionScheduled: { $exists: true },
    };
    if (sessionId) {
      sessionQuery._id = sessionId;
    }

    // First, check if there's an active session with a scheduled transition
    const checkSession = await Session.findOne(sessionQuery);

    if (!checkSession) {
      return res.status(200).json({ transitionExecuted: false });
    }

    const scheduledTime = new Date(checkSession.phase1TransitionScheduled);

    // If time hasn't passed yet, return countdown
    if (now < scheduledTime) {
      const secondsRemaining = Math.floor(
        (scheduledTime.getTime() - now.getTime()) / 1000,
      );
      return res.status(200).json({
        transitionExecuted: false,
        secondsRemaining: secondsRemaining,
      });
    }

    // Build atomic update query - add sessionId if provided
    const atomicQuery: Record<string, unknown> = {
      status: "active",
      phase: "phase1",
      phase1TransitionScheduled: {
        $exists: true,
        $lte: now, // Only if scheduled time has passed
      },
    };
    if (sessionId) {
      atomicQuery._id = sessionId;
    }

    // Time has passed! Use atomic findOneAndUpdate to claim the transition lock
    // This prevents race conditions when multiple clients try to execute simultaneously
    const activeSession = await Session.findOneAndUpdate(
      atomicQuery,
      {
        $set: { phase1TransitionScheduled: null }, // Clear immediately to prevent re-execution
      },
      {
        new: false, // Return the document BEFORE the update
      },
    );

    // If no session was updated, another request already claimed this transition
    if (!activeSession) {
      return res.status(200).json({ transitionExecuted: false });
    }

    // We now have exclusive ownership of this transition - proceed with execution
    const proposalCount = await Proposal.countDocuments({
      sessionId: activeSession._id,
      status: "active",
    });

    if (proposalCount < 2) {
      return res.status(400).json({
        error: `Atleast 2 proposals are required to transition. Current count: ${proposalCount}`,
      });
    }

    // Use admin-adjusted count if set, otherwise calculate using square root curve
    // Formula fits: 10→4, 20→5, 100→10 (approximately)
    const formulaCount = Math.max(
      2,
      Math.min(proposalCount, Math.round(1.2 * Math.sqrt(proposalCount))),
    );
    const topCount = activeSession.customTopCount
      ? Math.max(2, Math.min(proposalCount, activeSession.customTopCount))
      : formulaCount;

    // Get proposals ranked by average rating (computed at read time)
    const proposals = await Proposal.find({
      sessionId: activeSession._id,
      status: "active",
    }).lean();

    const ratings = await getRatingAggregates(
      ProposalRating,
      "proposalId",
      proposals.map((p) => p._id),
    );
    const rankedProposals = proposals.sort((a, b) => {
      const ra = ratings.get(a._id.toString());
      const rb = ratings.get(b._id.toString());
      return (
        (rb?.averageRating || 0) - (ra?.averageRating || 0) ||
        (rb?.ratingCount || 0) - (ra?.ratingCount || 0)
      );
    });

    // Move top proposals to "finalist" status
    const topProposalIds = rankedProposals.slice(0, topCount).map((p) => p._id);

    await Proposal.updateMany(
      { _id: { $in: topProposalIds } },
      { status: "finalist" },
    );

    // Archive the rest
    const archivedIds = rankedProposals.slice(topCount).map((p) => p._id);
    await Proposal.updateMany(
      { _id: { $in: archivedIds } },
      { status: "archived" },
    );

    // Update session to phase 2 and record start time
    // Note: phase1TransitionScheduled was already cleared atomically above
    activeSession.phase = "phase2";
    activeSession.phase2StartTime = new Date();
    activeSession.customTopCount = null;
    await activeSession.save();

    // Broadcast phase change to all connected clients
    await broadcaster.broadcast("phase-change", {
      phase: "phase2",
      sessionId: activeSession._id.toString(),
      topProposalsCount: topProposalIds.length,
    });

    return res.status(200).json({
      transitionExecuted: true,
      message: "Advanced to Phase 2",
      phase: "phase2",
      topProposalsCount: topProposalIds.length,
      archivedCount: archivedIds.length,
    });
  } catch (error) {
    log.error("Failed to execute scheduled transition", {
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to execute transition" });
  }
}
