import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { User } from "../../../../lib/models";
import { verifyMobileToken, signAccessToken, signRefreshToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileAuth");

/**
 * POST /api/mobile/auth/refresh
 * Body: { refreshToken: string }
 * Returns: { accessToken: string; refreshToken: string }
 *
 * Verifies the refresh token, re-fetches the user from DB to pick up
 * any role changes, and issues a new token pair.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: "refreshToken is required" });
  }

  try {
    const payload = verifyMobileToken(refreshToken, "refresh");

    await connectDB();
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      adminStatus: user.adminStatus || "none",
    };

    return res.status(200).json({
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload),
    });
  } catch (error) {
    log.error("Mobile token refresh failed", { error: error.message });
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}
