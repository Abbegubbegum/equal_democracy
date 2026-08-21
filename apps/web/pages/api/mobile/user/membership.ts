import type { NextApiRequest, NextApiResponse } from "next";
import { MEMBERSHIP_YEARS } from "@repo/types";
import connectDB from "../../../../lib/mongodb";
import { User } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
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

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await connectDB();

    const dbUser: any = await User.findById(user.id)
      .select("membershipStatus membershipPaidUntil membershipFirstPaidAt")
      .lean();
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });

    return res.status(200).json({
      status: dbUser.membershipStatus ?? "none",
      paidUntil: dbUser.membershipPaidUntil ?? null,
      firstPaidAt: dbUser.membershipFirstPaidAt ?? null,
      feeSek: getMembershipFee(),
      years: MEMBERSHIP_YEARS,
    });
  } catch (err: any) {
    log.error("Failed to read membership", {
      userId: user.id,
      error: err?.message,
    });
    return res.status(500).json({ message: "Kunde inte hämta medlemskap." });
  }
}
