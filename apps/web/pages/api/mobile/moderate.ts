import type { NextApiRequest, NextApiResponse } from "next";
import { requireParticipant } from "../../../lib/viewer";
import { moderateContent } from "../../../lib/ai";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MobileModerate");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

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
    log.error("Moderation failed", { error: (error as Error).message });
    return res.status(200).json({ status: "ok", message: "" });
  }
}
