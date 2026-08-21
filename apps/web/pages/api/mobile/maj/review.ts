import type { NextApiRequest, NextApiResponse } from "next";
import { verifyBearerToken } from "@/lib/mobile-jwt";
import { runMajReview } from "@/lib/maj-review";
import { createLogger } from "@/lib/logger";

const log = createLogger("MobileMajReview");

/**
 * POST /api/mobile/maj/review
 * Bearer-auth twin of /api/maj/review for the mobile create flows. Returns
 * { corrected, concise, duplicates }. Fails open so it never blocks posting.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { text, kind, title, questionId, stance } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return res
      .status(200)
      .json({ corrected: null, concise: null, duplicates: [] });
  }

  try {
    const result = await runMajReview({
      text,
      kind: kind === "argument" ? "argument" : "proposal",
      title: String(title || ""),
      questionId: questionId ? String(questionId) : undefined,
      stance: stance ? String(stance) : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    log.error("MAJ review failed", { error: (error as Error).message });
    return res
      .status(200)
      .json({ corrected: null, concise: null, duplicates: [] });
  }
}
