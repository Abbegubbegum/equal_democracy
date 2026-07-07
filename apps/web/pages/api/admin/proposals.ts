import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../lib/mongodb";
import {
  Proposal,
  Comment,
  ProposalRating,
  FinalVote,
  Session,
} from "../../../lib/models";
import { requireAdmin } from "../../../lib/admin";
import { csrfProtection } from "../../../lib/csrf";
import { getRatingAggregates } from "../../../lib/rating-helper";
import { createLogger } from "../../../lib/logger";

const log = createLogger("AdminProposals");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await connectDB();
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (!csrfProtection(req, res)) return;

  try {
    if (req.method === "GET") {
      const data = await Proposal.find().sort({ createdAt: -1 }).lean();

      const sessionIds = [
        ...new Set(data.map((p) => p.sessionId?.toString?.()).filter(Boolean)),
      ];
      const sessions = sessionIds.length
        ? await Session.find({ _id: { $in: sessionIds } })
            .select("title")
            .lean()
        : [];
      const sessionTitleById = Object.fromEntries(
        sessions.map((s) => [s._id.toString(), s.title]),
      );
      const ratings = await getRatingAggregates(
        ProposalRating,
        "proposalId",
        data.map((p) => p._id),
      );

      return res.status(200).json(
        data.map((p) => {
          const agg = ratings.get(p._id.toString());
          return {
            id: p._id.toString(),
            sessionId: p.sessionId?.toString?.() || null,
            sessionTitle: sessionTitleById[p.sessionId?.toString?.()] || null,
            title: p.title,
            problem: p.problem,
            solution: p.solution,
            status: p.status,
            ratingCount: agg?.ratingCount || 0,
            averageRating: agg?.averageRating || 0,
            categories: p.categories || [],
            imageUrl: p.imageUrl || null,
            authorId: p.authorId?.toString?.() || null,
            createdAt: p.createdAt,
          };
        }),
      );
    }

    if (req.method === "PATCH") {
      const { id, updates } = req.body;
      if (!id || typeof updates !== "object")
        return res.status(400).json({ message: "id and updates ir required" });
      const allowed = ["title", "problem", "solution", "status", "categories"];
      const $set = Object.fromEntries(
        Object.entries(updates).filter(([k]) => allowed.includes(k)),
      );
      if (Object.keys($set).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      const p = await Proposal.findByIdAndUpdate(
        id,
        { $set },
        {
          new: true,
          runValidators: true,
        },
      );
      if (!p) return res.status(404).json({ message: "Proposal not found" });
      return res.status(200).json({ id: p._id.toString() });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: "id is required" });
      await Promise.all([
        Comment.deleteMany({ proposalId: id }),
        ProposalRating.deleteMany({ proposalId: id }),
        FinalVote.deleteMany({ proposalId: id }),
      ]);
      await Proposal.findByIdAndDelete(id);
      return res.status(204).end();
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    log.error("Operation failed", { method: req.method, error: e.message });
    return res.status(500).json({ message: "An error has occured" });
  }
}
