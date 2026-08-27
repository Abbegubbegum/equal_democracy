import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import connectDB from "../../../../lib/mongodb";
import { Payment, User } from "../../../../lib/models";
import { requireAccount } from "../../../../lib/viewer";
import { createLogger } from "../../../../lib/logger";
import {
  getPaymentRequest,
  payerFacingMessage,
} from "../../../../lib/swish/payments";
import { settlePayment } from "../../../../lib/swish/settle";

const log = createLogger("MobilePaymentStatus");

/**
 * How stale our copy may be before we ask Swish directly. The app polls every
 * couple of seconds, so without this each poll would become an mTLS round trip.
 */
const POLL_THROTTLE_MS = 5000;

/** Swedish text for a finished payment, or null when there is nothing to say. */
function statusMessage(payment: any): string | null {
  switch (payment.status) {
    case "PAID":
    case "CREATED":
      return null;
    case "DECLINED":
    case "CANCELLED":
      return "Betalningen avbröts.";
    case "ERROR":
      return (
        payerFacingMessage(payment.errorCode) ??
        "Något gick fel med betalningen. Försök igen."
      );
    default:
      return null;
  }
}

/**
 * GET /api/mobile/payments/[id]
 *
 * Reports the state of one payment. Answers from our own database, and asks
 * Swish directly when our copy is still CREATED and older than the throttle —
 * that on-demand check is what makes the flow work in local development, where
 * Swish's callback cannot reach a machine behind NAT.
 *
 * Note the sibling route: Next resolves the static `swish.ts` before this
 * dynamic one, so `swish` can never be used as a payment id here.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  const viewer = await requireAccount(req, res);
  if (!viewer) return;

  const { id } = req.query;
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Betalningen hittades inte." });
  }

  try {
    await connectDB();

    // Scoped to the caller: one user must never be able to read another's
    // payment by guessing an id.
    const payment: any = await Payment.findOne({
      _id: id,
      userId: viewer.userId,
    });
    if (!payment) {
      return res.status(404).json({ message: "Betalningen hittades inte." });
    }

    if (payment.status === "CREATED") {
      const lastChecked = payment.lastPolledAt ?? payment.createdAt;
      const due =
        Date.now() - new Date(lastChecked).getTime() > POLL_THROTTLE_MS;

      if (due) {
        payment.lastPolledAt = new Date();
        await payment.save();

        try {
          const authoritative = await getPaymentRequest(payment.instructionId);
          if (authoritative && authoritative.status !== "CREATED") {
            await settlePayment(payment, authoritative);
          }
        } catch (err: any) {
          // A Swish outage must not break the polling UI — the app keeps
          // showing "waiting", and the reconcile cron closes this out later.
          log.warn("On-demand Swish check failed", {
            paymentId: String(payment._id),
            error: err?.message,
          });
        }
      }
    }

    const dbUser: any = await User.findById(viewer.userId)
      .select("membershipStatus membershipPaidUntil")
      .lean();

    return res.status(200).json({
      paymentId: String(payment._id),
      status: payment.status,
      errorCode: payment.errorCode ?? null,
      message: statusMessage(payment),
      membership: {
        status: dbUser?.membershipStatus ?? "none",
        paidUntil: dbUser?.membershipPaidUntil ?? null,
      },
    });
  } catch (err: any) {
    log.error("Failed to read payment status", {
      paymentId: id,
      error: err?.message,
    });
    return res
      .status(500)
      .json({ message: "Kunde inte hämta betalningsstatus." });
  }
}
