import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../../lib/mongodb";
import { createLogger } from "../../../../../lib/logger";
import { requireAccount } from "../../../../../lib/viewer";
import {
  confirmEmailClaim,
  requestEmailClaim,
} from "../../../../../lib/email-claim";

const log = createLogger("MobileEmailClaim");

/**
 * POST /api/mobile/user/email/claim
 * Body: { action: "request" | "confirm", email?, code? }
 *
 * The **verified** half of the contact-email story. Setting an address is
 * unverified and lives at ../email; this is what it takes to absorb the legacy
 * account that already held one — votes, proposals, and a paid membership.
 *
 * Reached from two places, both of which end in the same two steps:
 *   - the post-signup prompt ("did you already have an account with email?")
 *   - the settings field, when ../email answered MERGE_AVAILABLE
 *
 * `requireAccount`, deliberately not `requireParticipant`: someone who is
 * ineligible still owns their contact details, and recovering an old account is
 * precisely what a blocked user may need to do.
 *
 * This endpoint never returns a token. See lib/email-claim.ts for why that is a
 * rule rather than an omission.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const viewer = await requireAccount(req, res);
  if (!viewer) return;

  try {
    await connectDB();
    const action = req.body?.action;

    const result =
      action === "request"
        ? await requestEmailClaim(viewer.userId, req.body?.email)
        : action === "confirm"
          ? await confirmEmailClaim(viewer.userId, req.body?.code)
          : null;

    if (!result) return res.status(400).json({ error: "Okänd åtgärd" });

    return res.status(result.status).json({
      ok: result.ok,
      // `error` rather than `message` on failure, matching the sibling
      // /user/* routes and what apiClient reads for a human-readable reason.
      ...(result.ok ? { message: result.message } : { error: result.message }),
      merged: !!result.merged,
    });
  } catch (error) {
    log.error("email claim failed", { error: (error as Error).message });
    return res
      .status(500)
      .json({ error: "Något gick fel. Försök igen om en stund." });
  }
}
