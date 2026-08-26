import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import connectDB from "../../../../../lib/mongodb";
import { QuestionVote, VoteVerification } from "../../../../../lib/models";
import { verifyBearerToken } from "../../../../../lib/mobile-jwt";
import { createLogger } from "../../../../../lib/logger";
import {
  MIN_POLL_INTERVAL_MS,
  getBankIdSession,
} from "../../../../../lib/bankid/session";
import { settleVerification } from "../../../../../lib/bankid/settle";

const log = createLogger("MobileVoteVerificationStatus");

/**
 * Swedish for the ways a BankID order can end badly. Anything absent from here
 * is a code the voter cannot act on, and gets a generic message rather than a
 * leaked hintCode.
 */
const HINT_MESSAGES: Record<string, string> = {
  userCancel: "Du avbröt signeringen i BankID.",
  cancelled: "Signeringen avbröts.",
  expiredTransaction: "Signeringen tog för lång tid och avbröts.",
  startFailed: "BankID hann inte startas. Försök igen.",
  certificateErr: "Ditt BankID kunde inte användas. Kontakta din bank.",
  userDeclinedCall: "Signeringen avbröts.",
};

/**
 * GET /api/mobile/vote-verification/[id]
 *
 * Reports the state of one verification, asking GrandID when our copy is stale,
 * and settling it — writing the vote — the moment the signature completes.
 *
 * Scoped to the caller: another user's id answers 404 rather than 403, so the
 * endpoint cannot be used to discover that a verification exists at all.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.query;
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Verifieringen finns inte" });
  }

  try {
    await connectDB();

    const verification: any = await VoteVerification.findOne({
      _id: id,
      userId: user.id,
    });
    if (!verification) {
      return res.status(404).json({ message: "Verifieringen finns inte" });
    }

    let message = "";
    let reasonCode = verification.reasonCode ?? null;

    if (verification.status === "PENDING") {
      // The API's own floor is one poll every 2 seconds. Enforced here rather
      // than trusted to the client, which may be several app instances.
      const stale =
        !verification.lastPolledAt ||
        Date.now() - verification.lastPolledAt.getTime() >=
          MIN_POLL_INTERVAL_MS;

      if (stale) {
        verification.lastPolledAt = new Date();
        await verification.save();

        const session = await getBankIdSession(verification.grandIdSession);

        if (session.state === "complete") {
          const result = await settleVerification(verification, session);
          message = result.message;
          reasonCode = result.reasonCode;
        } else if (session.state === "failed") {
          verification.status = "FAILED";
          verification.reasonCode = session.hintCode;
          await verification.save();
          reasonCode = session.hintCode;
          message =
            HINT_MESSAGES[session.hintCode] ??
            "Signeringen kunde inte slutföras. Försök igen.";
        }
        // "pending" and "unknown" both mean keep waiting: while the voter is on
        // GrandID's hosted page, GetSession answers NOTLOGGEDIN, which is the
        // normal state of an order nobody has finished yet.
      }
    }

    // Vote counts are only meaningful once there is a vote. Fetching them on
    // every poll would be a needless aggregation while the user is still in
    // BankID.
    let voteCounts = null;
    if (verification.status === "VERIFIED") {
      const counts = await QuestionVote.aggregate([
        { $match: { questionId: verification.questionId } },
        { $group: { _id: "$choice", count: { $sum: 1 } } },
      ]);
      voteCounts = {
        ja: counts.find((c) => c._id === "ja")?.count ?? 0,
        nej: counts.find((c) => c._id === "nej")?.count ?? 0,
      };
    }

    return res.status(200).json({
      verificationId: verification._id.toString(),
      status: verification.status,
      reasonCode,
      message,
      voteCounts,
      userVote: verification.status === "VERIFIED" ? verification.choice : null,
    });
  } catch (error) {
    log.error("Failed to read verification status", {
      verificationId: id,
      error: error.message,
    });
    // Deliberately not an error status: the app polls this, and a transient
    // GrandID hiccup should leave it waiting rather than tear the sheet down.
    return res.status(200).json({
      verificationId: id,
      status: "PENDING",
      reasonCode: null,
      message: "",
      voteCounts: null,
      userVote: null,
    });
  }
}
