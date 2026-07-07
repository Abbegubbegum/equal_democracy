import type { NextApiRequest, NextApiResponse } from "next";
import { reviewContent } from "@/lib/ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createLogger } from "@/lib/logger";

const log = createLogger("majReview");

/**
 * POST /api/maj/review
 * MAJ's writing help at creation time: given a draft proposal/argument,
 * returns { corrected, concise } suggestions (each null if nothing to improve).
 * Fails open (nulls) so it never blocks posting.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { text, kind } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(200).json({ corrected: null, concise: null });
  }

  try {
    const result = await reviewContent({
      text,
      kind: kind === "argument" ? "argument" : "proposal",
    });
    return res.status(200).json(result);
  } catch (error) {
    log.error("MAJ review failed", { error: (error as Error).message });
    return res.status(200).json({ corrected: null, concise: null });
  }
}
