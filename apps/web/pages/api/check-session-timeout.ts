import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { Session, Question } from "@/lib/models";
import { closeSession } from "@/lib/session-close";
import {
  runMonthlyMotion,
  cullExpiredProposals,
} from "@/lib/forslag-maintenance";
import { createLogger } from "@/lib/logger";

const log = createLogger("SessionTimeout");

/**
 * Closes any active Session or Question whose own `deadline` has passed.
 * Both models carry their own deadline now — there is no global time limit.
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

    const currentTime = new Date();
    const closedSessions = [];

    // --- Standard sessions: close once their own deadline has passed ---
    const dueSessions = await Session.find({
      status: "active",
      deadline: { $lte: currentTime },
    });

    for (const session of dueSessions) {
      log.info("Session reached deadline", {
        sessionId: session._id.toString(),
        deadline: session.deadline,
      });

      await closeSession(session);
      closedSessions.push({
        sessionId: session._id,
        title: session.title,
        deadline: session.deadline,
      });
    }

    // --- Questions: close once their own deadline has passed ---
    const dueQuestions = await Question.find({
      status: "active",
      deadline: { $lte: currentTime },
    });

    const closedQuestions = [];
    for (const question of dueQuestions) {
      log.info("Question reached deadline", {
        questionId: question._id.toString(),
        deadline: question.deadline,
      });

      question.status = "closed";
      question.closedAt = currentTime;
      await question.save();

      closedQuestions.push({
        questionId: question._id,
        text: question.text,
        deadline: question.deadline,
      });
    }

    // --- Förslag stack maintenance: take the monthly motion (#1) first (so
    //     culling recomputes ranks without it), then cull the stragglers ---
    const motion = await runMonthlyMotion(currentTime);
    const culledProposals = await cullExpiredProposals(currentTime);

    const checked = dueSessions.length + dueQuestions.length;
    const closed = closedSessions.length + closedQuestions.length;

    return res.status(200).json({
      message: `Checked ${checked} item(s), closed ${closed}; motion ${
        motion ? "taken" : "none"
      }, culled ${culledProposals.length} proposal(s)`,
      checked,
      closed,
      closedSessions,
      closedQuestions,
      motion,
      culledProposals,
    });
  } catch (error) {
    log.error("Failed to check timeouts", { error: error.message });
    return res.status(500).json({
      error: "Failed to check timeouts",
      details: error.message,
    });
  }
}
