import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/admin";
import { csrfProtection } from "@/lib/csrf";
import connectDB from "@/lib/mongodb";
import { CitizenProposal, CitizenProposalRating, User } from "@/lib/models";
import { getRatingAggregates } from "@/lib/rating-helper";

const ALLOWED_STATUSES = [
  "active",
  "archived",
  "selected",
  "submitted_as_motion",
  "rejected",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (!csrfProtection(req, res)) return;

  await connectDB();

  if (req.method === "GET") {
    const proposals = await CitizenProposal.find({})
      .select(
        "_id title description authorId status imageUrl categories createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    const [ratings, authors] = await Promise.all([
      getRatingAggregates(
        CitizenProposalRating,
        "proposalId",
        proposals.map((p) => p._id),
      ),
      User.find({ _id: { $in: proposals.map((p) => p.authorId) } })
        .select("name")
        .lean(),
    ]);
    const authorNameById = Object.fromEntries(
      authors.map((u) => [u._id.toString(), u.name]),
    );

    const withRatings = proposals.map((p) => {
      const agg = ratings.get(p._id.toString());
      return {
        ...p,
        authorName: authorNameById[p.authorId?.toString?.()] || null,
        averageRating: agg?.averageRating || 0,
        ratingCount: agg?.ratingCount || 0,
      };
    });

    return res.status(200).json(withRatings);
  }

  if (req.method === "PATCH") {
    const { id, status, title, description, categories } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const $set: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      $set.status = status;
    }
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      $set.title = title.trim();
    }
    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "Description cannot be empty" });
      }
      $set.description = description.trim();
    }
    if (categories !== undefined) {
      if (
        !Array.isArray(categories) ||
        !categories.every((c) => typeof c === "string")
      ) {
        return res.status(400).json({ error: "Invalid categories" });
      }
      $set.categories = categories;
    }
    if (Object.keys($set).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    try {
      await CitizenProposal.findByIdAndUpdate(id, $set, {
        runValidators: true,
      });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || "Update failed" });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
