import type { NextApiRequest, NextApiResponse } from "next";
import { moderateContent } from "@/lib/ai";
import { requireParticipant } from "@/lib/viewer";
import { createLogger } from "@/lib/logger";

const log = createLogger("moderate");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const viewer = await requireParticipant(req, res);
  if (!viewer) return;

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
