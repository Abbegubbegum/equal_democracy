import type { NextApiRequest, NextApiResponse } from "next";
import { MEMBERSHIP_YEARS } from "@repo/types";
import connectDB from "../../../../lib/mongodb";
import { User } from "../../../../lib/models";
import { getViewer } from "../../../../lib/viewer";
import { createLogger } from "../../../../lib/logger";
import { getMembershipFee } from "../../../../lib/membership";

const log = createLogger("MobileMembership");

/**
 * GET /api/mobile/user/membership
 *
 * The Info tab's source of truth for whether to show "Betala med Swish" or a
 * member badge. Read fresh rather than from the JWT: membership changes long
 * after sign-in, and access tokens live for 7 days, so a token-embedded flag
 * would leave a paying member looking unpaid for a week.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  // **No auth.** What membership costs and which years it covers is public
  // information — the Info tab is readable signed out, and a visitor deciding
  // whether to join needs to see the price before they log in. Only the
  // caller's own status is account-scoped, and that is simply "none" without
  // one.
  try {
    await connectDB();
    const viewer = await getViewer(req, res);

    const dbUser: any = viewer.userId
      ? await User.findById(viewer.userId)
          .select("membershipStatus membershipPaidUntil membershipFirstPaidAt")
          .lean()
      : null;

    return res.status(200).json({
      status: dbUser?.membershipStatus ?? "none",
      paidUntil: dbUser?.membershipPaidUntil ?? null,
      firstPaidAt: dbUser?.membershipFirstPaidAt ?? null,
      feeSek: getMembershipFee(),
      years: MEMBERSHIP_YEARS,
    });
  } catch (err: any) {
    log.error("Failed to read membership", { error: err?.message });
    return res.status(500).json({ message: "Kunde inte hämta medlemskap." });
  }
}
