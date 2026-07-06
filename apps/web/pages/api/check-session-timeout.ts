import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Session, Settings } from "@/lib/models";
import { closeSession } from "@/lib/session-close";
import { createLogger } from "@/lib/logger";

const log = createLogger("SessionTimeout");

/**
 * Closes any active standard/survey/municipal session that has exceeded
 * Settings.sessionLimitHours, and any active "voting" (mobile Ja/Nej) session
 * that has passed its own admin-set `deadline`. "voting" sessions are never
 * subject to sessionLimitHours — they run until their deadline or a manual
 * admin close.
 * Invoked by Vercel Cron (see apps/web/vercel.json) with a Bearer CRON_SECRET.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !process.env.CRON_SECRET ||
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await dbConnect();

    // Get the session limit from settings
    const settings = await Settings.findOne({});
    const sessionLimitHours = settings?.sessionLimitHours || 24;

    const currentTime = new Date();
    const closedSessions = [];

    // --- Standard/survey/municipal sessions: close on sessionLimitHours ---
    const timedSessions = await Session.find({
      status: "active",
      sessionType: { $ne: "voting" },
    });

    for (const session of timedSessions) {
      if (!session.startDate) continue;

      const sessionStartTime = new Date(session.startDate);
      const elapsedHours =
        (currentTime.getTime() - sessionStartTime.getTime()) / (1000 * 60 * 60);

      if (elapsedHours >= sessionLimitHours) {
        log.info("Session exceeded time limit", {
          sessionId: session._id.toString(),
          elapsedHours: elapsedHours.toFixed(1),
          limitHours: sessionLimitHours,
        });

        await closeSession(session);
        closedSessions.push({
          sessionId: session._id,
          place: session.place,
          elapsedHours: elapsedHours.toFixed(1),
          limitHours: sessionLimitHours,
        });
      }
    }

    // --- "voting" (mobile Ja/Nej) sessions: close on their own deadline ---
    const dueVotingSessions = await Session.find({
      status: "active",
      sessionType: "voting",
      deadline: { $lte: currentTime },
    });

    for (const session of dueVotingSessions) {
      log.info("Voting session reached deadline", {
        sessionId: session._id.toString(),
        deadline: session.deadline,
      });

      await closeSession(session);
      closedSessions.push({
        sessionId: session._id,
        place: session.place,
        deadline: session.deadline,
      });
    }

    const checked = timedSessions.length + dueVotingSessions.length;

    if (checked === 0) {
      return res.status(200).json({
        message: "No active sessions to check",
        checked: 0,
        closed: 0,
      });
    }

    return res.status(200).json({
      message: `Checked ${checked} session(s), closed ${closedSessions.length}`,
      checked,
      closed: closedSessions.length,
      closedSessions,
      sessionLimitHours,
    });
  } catch (error) {
    log.error("Failed to check session timeouts", { error: error.message });
    return res.status(500).json({
      error: "Failed to check session timeouts",
      details: error.message,
    });
  }
}
