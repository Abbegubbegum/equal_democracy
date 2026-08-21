import { applyPaidPayment } from "../membership";
import { createLogger } from "../logger";
import type { SwishPaymentObject } from "./payments";

const log = createLogger("SwishSettle");

export interface SettleResult {
  /** True when this call moved the payment out of CREATED. */
  changed: boolean;
  status: string;
  /** True when membership was granted as a result. */
  membershipGranted: boolean;
}

/**
 * Applies an authoritative Swish payment object to our Payment row.
 *
 * Shared by the callback, the status endpoint's on-demand check, and the
 * reconcile cron — all three can legitimately learn the outcome first, and all
 * three must reach the same result. Transitions are one-way: once a payment
 * leaves CREATED it is never rewritten, so a replayed callback is a no-op.
 *
 * `payment` is a live Mongoose document; it is saved here when it changes.
 */
export async function settlePayment(
  payment: any,
  swishPayment: SwishPaymentObject,
): Promise<SettleResult> {
  const paymentId = String(payment._id);

  if (payment.status !== "CREATED") {
    log.info("Payment already settled — ignoring", {
      paymentId,
      status: payment.status,
      incoming: swishPayment.status,
    });
    return {
      changed: false,
      status: payment.status,
      membershipGranted: false,
    };
  }

  // The amount is never taken from the incoming data; it is only ever compared
  // against what we asked Swish to charge.
  const reported = Number(swishPayment.amount);
  if (
    !Number.isFinite(reported) ||
    Math.abs(reported - payment.amount) > 0.005
  ) {
    log.error("Swish reported a different amount than we requested", {
      paymentId,
      expected: payment.amount,
      reported: swishPayment.amount,
    });
    payment.status = "ERROR";
    payment.errorCode = "AMOUNT_MISMATCH";
    payment.errorMessage = `Expected ${payment.amount}, Swish reported ${swishPayment.amount}`;
    await payment.save();
    return { changed: true, status: "ERROR", membershipGranted: false };
  }

  payment.status = swishPayment.status;
  payment.paymentReference = swishPayment.paymentReference ?? null;
  payment.payerAlias = swishPayment.payerAlias ?? null;
  payment.errorCode = swishPayment.errorCode ?? null;
  payment.errorMessage = swishPayment.errorMessage ?? null;
  payment.datePaid = swishPayment.datePaid
    ? new Date(swishPayment.datePaid)
    : null;
  await payment.save();

  log.info("Payment settled", {
    paymentId,
    status: payment.status,
    errorCode: payment.errorCode,
  });

  let membershipGranted = false;
  if (payment.status === "PAID") {
    membershipGranted = await applyPaidPayment(payment);
  }

  return { changed: true, status: payment.status, membershipGranted };
}
