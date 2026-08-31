import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { createLogger } from "../../../../lib/logger";
import { describeViewer, getViewer } from "../../../../lib/viewer";
import { MEMBERSHIP_FEE_SEK, MEMBERSHIP_YEARS } from "@repo/types";

const log = createLogger("MobileMe");

/**
 * GET /api/mobile/user/me
 *
 * What the app needs to decide what to render: who this is, what they may do,
 * and which of the things membership requires are still missing.
 *
 * **No auth required.** An anonymous caller gets `capability: "anonymous"` and
 * nulls, which is a real answer rather than an error — the app is browsable
 * signed out, and the login screen needs to be able to ask this too.
 *
 * Always read from the database, never from the token. Capability changes the
 * moment someone links BankID; access tokens live seven days.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    await connectDB();
    const viewer = await getViewer(req, res);

    const feeOverride = Number(process.env.MEMBERSHIP_FEE_SEK);
    const feeSek =
      Number.isFinite(feeOverride) && feeOverride >= 1
        ? feeOverride
        : MEMBERSHIP_FEE_SEK;

    return res
      .status(200)
      .json(describeViewer(viewer, feeSek, MEMBERSHIP_YEARS));
  } catch (error) {
    log.error("Failed to read viewer", { error: (error as Error).message });
    return res.status(500).json({ message: "Kunde inte hämta kontot" });
  }
}
