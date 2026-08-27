import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { Session, WinningProposal } from "../../../../lib/models";
import { createLogger } from "../../../../lib/logger";

const log = createLogger("MobileArchived");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  // Public: readable without an account, like every other GET on this
  // surface. The app is fully browsable signed out.
  try {
    await connectDB();

    const sessions = await Session.find({
      status: "closed",
    })
      .select("_id title startDate endDate status")
      .sort({ startDate: -1 })
      .lean();

    const result = await Promise.all(
      sessions.map(async (session) => {
        const winningProposals = await WinningProposal.find({
          sessionId: session._id,
        })
          .select("title yesVotes noVotes")
          .lean();
        return {
          id: session._id.toString(),
          title: session.title,
          startDate: session.startDate,
          endDate: session.endDate || null,
          status: session.status,
          topProposals: winningProposals.map((wp) => ({
            title: wp.title,
            yesVotes: wp.yesVotes,
            noVotes: wp.noVotes,
          })),
        };
      }),
    );

    return res.status(200).json(result);
  } catch (error) {
    log.error("Failed to fetch archived sessions", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch archive" });
  }
}
