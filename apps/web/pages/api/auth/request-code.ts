import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { User, LoginCode, Settings } from "../../../lib/models";
import { sendLoginCode } from "../../../lib/email";
import { createLogger } from "../../../lib/logger";

const log = createLogger("Auth");

export function random6() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Email is required" });

  // Google Play review bypass: a single whitelisted test email never receives
  // a real OTP email — it logs in with a fixed code instead (checked in
  // /api/mobile/auth/verify-code). Env-controlled so it can be disabled
  // instantly by unsetting REVIEW_TEST_EMAIL.
  const reviewEmail = process.env.REVIEW_TEST_EMAIL?.toLowerCase();
  if (reviewEmail && email.toLowerCase() === reviewEmail) {
    return res.status(200).json({ ok: true, alreadySent: false });
  }

  await connectDB();

  // Delete any stale (expired) codes
  await LoginCode.deleteMany({
    email: email.toLowerCase(),
    expiresAt: { $lte: new Date() },
  });

  // Nothing to send a code to any more unless the account already exists and
  // still logs in by email. Both other cases — no account, or a BankID account
  // whose email is now only a contact channel (C1) — would produce a code that
  // can never be redeemed.
  //
  // The response is deliberately identical either way: this endpoint has never
  // revealed whether an address is registered, and it must not start now.
  const account: any = await User.findOne({ email: email.toLowerCase() })
    .select("authMethod bankidSubject")
    .lean();
  if (!account || account.authMethod === "bankid" || account.bankidSubject) {
    return res.status(200).json({ ok: true, alreadySent: false });
  }

  // If a valid code already exists, just let the user proceed — don't resend
  const existingActive = await LoginCode.findOne({
    email: email.toLowerCase(),
    expiresAt: { $gt: new Date() },
  });
  if (existingActive) {
    return res.status(200).json({ ok: true, alreadySent: true });
  }

  const settings = await Settings.findOne();
  const language = settings?.language || "sv";

  const code = random6();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await LoginCode.create({
    email: email.toLowerCase(),
    codeHash,
    expiresAt,
  });

  try {
    await sendLoginCode(email, code, language);
  } catch (e) {
    await LoginCode.deleteMany({
      email: email.toLowerCase(),
      expiresAt: { $gt: new Date() },
    });
    log.error("Failed to send login code", { error: e.message });
    return res.status(500).json({ message: "Could not send code" });
  }

  return res.status(200).json({ ok: true, alreadySent: false });
}
