import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Session } from "../../../../lib/models";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileSessions");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Public: readable without an account, like every other GET on this
  // surface. The app is fully browsable signed out.
  try {
    await connectDB();

    const sessions = await Session.find({
      status: "active",
    })
      .select(
        "_id title phase startDate activeUsers showUserCount imageUrl noMotivation categories",
      )
      .sort({ startDate: -1 })
      .lean();

    return res.status(200).json(
      sessions.map((s) => ({
        id: s._id.toString(),
        title: s.title,
        phase: s.phase,
        startDate: s.startDate,
        activeUsersCount: s.activeUsers?.length || 0,
        showUserCount: s.showUserCount || false,
        noMotivation: s.noMotivation || false,
        imageUrl: s.imageUrl || null,
        categories: s.categories || [],
      })),
    );
  } catch (error) {
    log.error("Failed to fetch mobile sessions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch sessions" });
  }
}
