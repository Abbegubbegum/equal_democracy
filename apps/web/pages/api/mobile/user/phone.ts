import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { User } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { formatPhoneNumber } from "../../../../lib/sms";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { phoneNumber } = req.body as { phoneNumber?: unknown };
  if (typeof phoneNumber !== "string")
    return res.status(400).json({ error: "phoneNumber must be a string" });

  await connectDB();

  const trimmed = phoneNumber.trim();
  if (trimmed === "") {
    await User.findByIdAndUpdate(user.id, {
      phoneNumber: "",
      notificationPreference: "email",
    });
    return res.status(200).json({ ok: true, phoneNumber: null });
  }

  const formatted = formatPhoneNumber(trimmed);
  if (!formatted)
    return res.status(400).json({ error: "Ogiltigt telefonnummer" });

  await User.findByIdAndUpdate(user.id, {
    phoneNumber: formatted,
    notificationPreference: "both",
  });

  return res.status(200).json({ ok: true, phoneNumber: formatted });
}
