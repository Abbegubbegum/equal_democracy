import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { classifyCategories } from "@/lib/ai";
import { hasAdminAccess } from "@/lib/admin-helper";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session || !hasAdminAccess(session.user)) {
    return res.status(403).json({ error: "Unauthorized" });
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
