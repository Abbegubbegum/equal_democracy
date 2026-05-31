import type { NextApiRequest, NextApiResponse } from "next";
import { classifyCategories } from "../../../lib/ai";
import { verifyBearerToken } from "../../../lib/mobile-jwt";

// ── Input / Output contract ──────────────────────────────────────────────────
// POST { title: string, description?: string }
// 200  { categories: ContentCategory[] }   — 1-3 items from ALL_CATEGORIES
// 400  { error: string }
// 401  { error: string }
// ────────────────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { title, description } = req.body as {
    title?: string;
    description?: string;
  };
  if (!title?.trim())
    return res.status(400).json({ error: "title is required" });

  const categories = await classifyCategories({
    title: title.trim(),
    description: description?.trim(),
  });
  return res.status(200).json({ categories });
}
