import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "@/lib/mongodb";
import { Payment } from "@/lib/models";
import { createLogger } from "@/lib/logger";
import { getSwishConfig } from "@/lib/swish/config";
import { getPaymentRequest } from "@/lib/swish/payments";
import { settlePayment } from "@/lib/swish/settle";

const log = createLogger("SwishReconcile");

/**
 * Swish's own backend gives up on an unsigned payment after 5.5 minutes, so a
 * payment still CREATED after ten has a final state waiting at Swish — or was
 * never registered there at all.
 */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Beyond this we stop believing Swish will ever recognise the payment. A row
 * this old with no counterpart means our create call died between writing the
 * document and Swish accepting it.
 */
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/** Keeps the run inside the function timeout; each check is an mTLS round trip. */
const BATCH_LIMIT = 100;

/**
 * Closes out payments whose outcome we never learned.
 *
 * The safety net beneath both the callback and the app's polling: a callback
 * can be lost, and the app can be killed mid-payment before it polls again.
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
    await connectDB();
    const { env } = getSwishConfig();

    // Scoped to this deployment's Swish environment. Without it a production
    // run would look up sandbox payments against the production API, fail to
    // find them, and wrongly mark them abandoned.
    const stale = await Payment.find({
      status: "CREATED",
      env,
      createdAt: { $lte: new Date(Date.now() - STALE_AFTER_MS) },
    })
      .sort({ createdAt: 1 })
      .limit(BATCH_LIMIT);

    const summary = {
      scanned: stale.length,
      settled: 0,
      stillPending: 0,
      abandoned: 0,
      failed: 0,
    };

    for (const payment of stale) {
      const paymentId = String(payment._id);
      try {
        payment.lastPolledAt = new Date();

        const authoritative = await getPaymentRequest(payment.instructionId);

        if (!authoritative) {
          const age = Date.now() - new Date(payment.createdAt).getTime();
          if (age > ABANDON_AFTER_MS) {
            payment.status = "ERROR";
            payment.errorCode = "UNKNOWN_AT_SWISH";
            payment.errorMessage =
              "Swish has no record of this payment request";
            await payment.save();
            summary.abandoned++;
            log.warn("Abandoned a payment Swish does not recognise", {
              paymentId,
              instructionId: payment.instructionId,
            });
          } else {
            await payment.save();
            summary.stillPending++;
          }
          continue;
        }

        if (authoritative.status === "CREATED") {
          await payment.save();
          summary.stillPending++;
          continue;
        }

        // settlePayment saves, which persists lastPolledAt along with it.
        const result = await settlePayment(payment, authoritative);
        if (result.changed) summary.settled++;
      } catch (err: any) {
        // Leave it CREATED — the next run tries again.
        summary.failed++;
        log.error("Reconcile failed for payment", {
          paymentId,
          error: err?.message,
        });
      }
    }

    log.info("Reconcile run complete", { env, ...summary });
    return res.status(200).json({ ok: true, env, ...summary });
  } catch (err: any) {
    log.error("Reconcile run failed", { error: err?.message });
    return res.status(500).json({ error: "Reconcile failed" });
  }
}
