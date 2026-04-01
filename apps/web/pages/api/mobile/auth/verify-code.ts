import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import connectDB from "../../../../lib/mongodb";
import { User, LoginCode } from "../../../../lib/models";
import { signAccessToken, signRefreshToken } from "../../../../lib/mobile-jwt";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileAuth");

/**
 * POST /api/mobile/auth/verify-code
 * Body: { email: string; code: string }
 * Returns: { accessToken: string; refreshToken: string; user: { id, email, name, isAdmin, isSuperAdmin } }
 *
 * Same OTP flow as the web — request the code via POST /api/auth/request-code first.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const email = req.body?.email?.toLowerCase?.()?.trim();
  const code = req.body?.code?.trim();

  if (!email || !code) {
    return res.status(400).json({ message: "Email and code are required" });
  }

  try {
    await connectDB();

    const rec = await LoginCode.findOne({
      email,
      expiresAt: { $gt: new Date() },
    });

    if (!rec) {
      return res.status(401).json({ message: "Code is invalid or expired" });
    }

    if (rec.attempts >= 5) {
      await LoginCode.deleteMany({ email });
      return res.status(401).json({ message: "Too many failed attempts, request a new code" });
    }

    const ok = await bcrypt.compare(code, rec.codeHash);
    if (!ok) {
      rec.attempts += 1;
      await rec.save();
      return res.status(401).json({ message: "Code is invalid" });
    }

    // Consume the code
    await LoginCode.deleteMany({ email });

    let user = await User.findOne({ email });
    if (!user) {
      const name =
        email
          .split("@")[0]
          .replace(/[._-]/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
          .slice(0, 60) || "Citizen";

      user = await User.create({ name, email });
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
      user: {
        id: tokenPayload.id,
        email: tokenPayload.email,
        name: tokenPayload.name,
        isAdmin: tokenPayload.isAdmin,
        isSuperAdmin: tokenPayload.isSuperAdmin,
      },
    });
  } catch (error) {
    log.error("Mobile auth failed", { error: error.message });
    return res.status(500).json({ message: "Authentication failed" });
  }
}
