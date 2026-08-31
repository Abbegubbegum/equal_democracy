import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import connectDB from "../../../../../lib/mongodb";
import { VoteVerification } from "../../../../../lib/models";
import { requireParticipant } from "../../../../../lib/viewer";
import { createLogger } from "../../../../../lib/logger";
import { cancelBankIdSession } from "../../../../../lib/bankid/session";

const log = createLogger("MobileVoteVerificationCancel");

/**
 * POST /api/mobile/vote-verification/[id]/cancel
 *
 * Abandons an in-flight signing order. Without this a user who backs out leaves
 * an order occupying their BankID for a few minutes, and the next attempt would
 * be refused as one already ongoing.
 *
 * Only PENDING rows are affected — a verification that already produced a vote
 * is never rewritten, here or anywhere else.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const viewer = await requireParticipant(req, res);
  if (!viewer) return;

  const { id } = req.query;
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Verifieringen finns inte" });
  }

  try {
    await connectDB();

    const verification: any = await VoteVerification.findOne({
      _id: id,
      userId: viewer.userId,
    });
    if (!verification) {
      return res.status(404).json({ message: "Verifieringen finns inte" });
    }

    if (verification.status !== "PENDING") {
      return res.status(200).json({ status: verification.status });
    }

    // Best-effort: GrandID may already have expired the order, and failing to
    // cancel is not something to surface to a user who has walked away.
    await cancelBankIdSession(verification.grandIdSession, {
      service: "sign",
    });

    verification.status = "CANCELLED";
    verification.reasonCode = "userCancel";
    await verification.save();

    log.info("Vote verification cancelled", { verificationId: id });

    return res.status(200).json({ status: "CANCELLED" });
  } catch (error) {
    log.error("Failed to cancel verification", {
      verificationId: id,
      error: error.message,
    });
    return res.status(500).json({ message: "Kunde inte avbryta signeringen." });
  }
}
