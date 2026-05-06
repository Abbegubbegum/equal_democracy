import type { NextApiRequest, NextApiResponse } from "next";
import { verifyBearerToken } from "@/lib/mobile-jwt";
import connectDB from "@/lib/mongodb";
import { User } from "@/lib/models";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await verifyBearerToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { token } = req.body;
  if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
    return res.status(400).json({ error: "Invalid push token" });
  }

  await connectDB();
  await User.findByIdAndUpdate(user.id, { expoPushToken: token });

  return res.status(200).json({ ok: true });
}
