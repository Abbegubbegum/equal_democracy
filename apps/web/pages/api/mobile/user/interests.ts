import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { User } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { ALL_CATEGORIES } from "@repo/types";

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

  const { interests } = req.body as { interests?: unknown };
  if (!Array.isArray(interests))
    return res.status(400).json({ error: "interests must be an array" });

  const valid = (interests as unknown[]).filter(
    (c): c is string =>
      typeof c === "string" &&
      (ALL_CATEGORIES as readonly string[]).includes(c),
  );

  await connectDB();
  await User.findByIdAndUpdate(user.id, { interests: valid });

  return res.status(200).json({ ok: true });
}
