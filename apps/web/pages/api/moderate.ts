import type { NextApiRequest, NextApiResponse } from "next";
import { moderateContent } from "@/lib/ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { createLogger } from "@/lib/logger";

const log = createLogger("moderate");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { text } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(200).json({ status: "ok", message: "" });
  }

  try {
    const result = await moderateContent(text);
    return res.status(200).json(result);
  } catch (error) {
    log.error("Moderation check failed", { error: error.message });
    return res.status(200).json({ status: "ok", message: "" });
  }
}
