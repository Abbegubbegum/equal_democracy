import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "@/lib/mongodb";
import { createLogger } from "@/lib/logger";
import { describeViewer, getViewer } from "@/lib/viewer";
import { MEMBERSHIP_FEE_SEK, MEMBERSHIP_YEARS } from "@repo/types";

const log = createLogger("WebMe");

/**
 * GET /api/user/me
 *
 * Who this is and what they may do. **No auth required** — an anonymous caller
 * gets `capability: "anonymous"` and nulls, which is a real answer: the site is
 * readable signed out.
 *
 * Web twin of /api/mobile/user/me, sharing `describeViewer` so the two surfaces
 * cannot drift on what a user is allowed to do.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    await connectDB();
    const viewer = await getViewer(req, res);
    const override = Number(process.env.MEMBERSHIP_FEE_SEK);
    const feeSek =
      Number.isFinite(override) && override >= 1
        ? override
        : MEMBERSHIP_FEE_SEK;
    return res
      .status(200)
      .json(describeViewer(viewer, feeSek, MEMBERSHIP_YEARS));
  } catch (error) {
    log.error("Failed to read viewer", { error: (error as Error).message });
    return res.status(500).json({ message: "Kunde inte hämta kontot" });
  }
}
