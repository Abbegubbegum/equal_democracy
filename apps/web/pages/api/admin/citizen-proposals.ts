import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/mongodb";
import { CitizenProposal } from "@/lib/models";

const ALLOWED_STATUSES = ["active", "archived", "selected", "submitted_as_motion", "rejected"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  await connectDB();

  if (req.method === "GET") {
    const proposals = await CitizenProposal.find({})
      .select("_id title description authorName status averageRating ratingCount imageUrl createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(proposals);
  }

  if (req.method === "PATCH") {
    const { id, status } = req.body;
    if (!id || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid id or status" });
    }
    await CitizenProposal.findByIdAndUpdate(id, { status });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
