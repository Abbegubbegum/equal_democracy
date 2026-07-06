import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ProposalRating } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { getRatingAggregates } from "@/lib/rating-helper";
import broadcaster from "@/lib/pusher-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("Sessions");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await dbConnect();

  // CSRF protection for state-changing methods
  if (!csrfProtection(req, res)) {
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get sessionId from request body (optional for backward compatibility)
    const { sessionId, topCount: requestedTopCount } = req.body;

    // Get active session (with optional sessionId)
    const activeSession = sessionId
      ? await Session.findOne({ _id: sessionId, status: "active" })
      : await Session.findOne({ status: "active" });

    if (!activeSession) {
      return res.status(404).json({ error: "No active session found" });
    }

    if (activeSession.phase === "phase1") {
      // Transition from Phase 1 to Phase 2
      // Check if we have at least 2 proposals
      const proposalCount = await Proposal.countDocuments({
        sessionId: activeSession._id,
        status: "active",
      });

      if (proposalCount < 2) {
        return res.status(400).json({
          error: `Atleast 2 proposals are required to transition. Current count: ${proposalCount}`,
        });
      }

      // Use requested topCount if provided, otherwise use 40% formula
      const formulaCount = Math.min(
        proposalCount,
        Math.max(2, Math.ceil(proposalCount * 0.4)),
      );
      const topCount = requestedTopCount
        ? Math.max(2, Math.min(proposalCount, parseInt(requestedTopCount)))
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
      const topProposalIds = rankedProposals
        .slice(0, topCount)
        .map((p) => p._id);

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
      activeSession.phase = "phase2";
      activeSession.phase2StartTime = new Date();
      await activeSession.save();

      // Broadcast phase change to all connected clients
      await broadcaster.broadcast("phase-change", {
        phase: "phase2",
        sessionId: activeSession._id.toString(),
        topProposalsCount: topProposalIds.length,
      });

      return res.status(200).json({
        message: "Advanced to Phase 2",
        phase: "phase2",
        topProposalsCount: topProposalIds.length,
        archivedCount: archivedIds.length,
      });
    } else if (activeSession.phase === "phase2") {
      return res.status(400).json({
        error: "Already in Phase 2. Use close-session to finish.",
      });
    } else {
      return res.status(400).json({
        error: "Session is closed",
      });
    }
  } catch (error) {
    log.error("Failed to advance phase", {
      sessionId: req.body?.sessionId,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to advance phase" });
  }
}
