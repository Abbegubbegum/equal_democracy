import type { NextApiRequest, NextApiResponse } from "next";
import { requireAccount } from "@/lib/viewer";
import connectDB from "@/lib/mongodb";
import { User } from "@/lib/models";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const viewer = await requireAccount(req, res);
  if (!viewer) return;

  const { token } = req.body;
  if (
    !token ||
    typeof token !== "string" ||
    !token.startsWith("ExponentPushToken[")
  ) {
    return res.status(400).json({ error: "Invalid push token" });
  }

  await connectDB();
  await User.findByIdAndUpdate(viewer.userId, { expoPushToken: token });

  return res.status(200).json({ ok: true });
}
