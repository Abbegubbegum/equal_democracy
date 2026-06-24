import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/admin";
import { csrfProtection } from "@/lib/csrf";
import connectDB from "@/lib/mongodb";
import { CitizenProposal } from "@/lib/models";

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
        "_id title description authorName status averageRating ratingCount imageUrl categories createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(proposals);
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
