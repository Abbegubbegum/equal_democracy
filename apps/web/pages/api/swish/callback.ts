import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../lib/mongodb";
import { Payment } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";
import { getPaymentRequest } from "../../../lib/swish/payments";
import { settlePayment } from "../../../lib/swish/settle";

const log = createLogger("SwishCallback");

/**
 * POST /api/swish/callback
 *
 * Swish notifies us here when a payment reaches PAID / DECLINED / ERROR /
 * CANCELLED. Deliberately unauthenticated — Swish cannot present credentials —
 * which drives three rules:
 *
 *  1. NO CSRF. csrfProtection() must never be added to this route; Swish has no
 *     way to obtain a token and every callback would 403.
 *  2. The request body is treated as a *notification only*, never as truth. We
 *     re-fetch the payment from Swish over mTLS and settle from that, so a
 *     forged POST cannot mark anything paid no matter what it contains.
 *  3. Answer 200 for anything we cannot act on. Swish retries up to 10 times
 *     over ~2 minutes until it gets a 200, and retrying an unknown payment will
 *     never start working — most commonly it is a sandbox callback for a
 *     payment that only exists in a developer's local database.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const body: any = req.body ?? {};
  const instructionId = typeof body.id === "string" ? body.id : null;
  const reference =
    typeof body.payeePaymentReference === "string"
      ? body.payeePaymentReference
      : null;

  if (!instructionId && !reference) {
    log.warn("Callback without an identifiable payment", { body });
    return res.status(200).json({ ok: true });
  }

  try {
    await connectDB();

    const payment: any = instructionId
      ? await Payment.findOne({ instructionId })
      : await Payment.findById(reference).catch(() => null);

    if (!payment) {
      log.warn("Callback for an unknown payment — ignoring", {
        instructionId,
        reference,
        status: body.status,
      });
      return res.status(200).json({ ok: true });
    }

    const paymentId = String(payment._id);

    // Defence in depth. The authoritative re-fetch below is what actually makes
    // forgery pointless, but a mismatch here means something is wrong enough to
    // stop for: either a spoofed callback, or two environments sharing a URL.
    const echoed = req.headers["callbackidentifier"];
    if (typeof echoed === "string" && echoed !== payment.callbackIdentifier) {
      log.error("Callback identifier mismatch — rejecting", {
        paymentId,
        instructionId,
      });
      return res.status(403).json({ message: "Invalid callback identifier" });
    }
    if (!echoed) {
      // Not fatal: we verify against Swish directly regardless.
      log.warn("Callback arrived without a callbackIdentifier header", {
        paymentId,
      });
    }

    payment.rawCallback = body;

    if (payment.status !== "CREATED") {
      await payment.save();
      log.info("Callback for an already-settled payment — no-op", {
        paymentId,
        status: payment.status,
      });
      return res.status(200).json({ ok: true });
    }

    // Ask Swish what actually happened rather than believing the POST body.
    const authoritative = await getPaymentRequest(payment.instructionId);
    if (!authoritative) {
      log.error("Swish does not recognise the payment from its own callback", {
        paymentId,
        instructionId: payment.instructionId,
      });
      await payment.save();
      return res.status(200).json({ ok: true });
    }

    const result = await settlePayment(payment, authoritative);

    log.info("Callback processed", {
      paymentId,
      status: result.status,
      membershipGranted: result.membershipGranted,
      claimedStatus: body.status,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    // A 500 makes Swish retry, which is what we want for a transient failure
    // such as a dropped database connection.
    log.error("Callback processing failed", {
      instructionId,
      reference,
      error: err?.message,
    });
    return res.status(500).json({ message: "Callback processing failed" });
  }
}
