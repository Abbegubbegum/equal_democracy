import { MEMBERSHIP_FEE_SEK, MEMBERSHIP_YEARS } from "@repo/types";
import { createLogger } from "./logger";
import { User } from "./models";
import { getSwishConfig } from "./swish/config";

const log = createLogger("Membership");

/**
 * The fee to charge, in SEK.
 *
 * `MEMBERSHIP_FEE_SEK` in the environment overrides the constant so the amount
 * can be changed without a deploy — and, more importantly, without a new mobile
 * build: the app renders whatever the API reports rather than a bundled value.
 * That is what makes a 1 kr live end-to-end test possible before switching to
 * the real 250 kr.
 */
export function getMembershipFee(): number {
  const override = Number(process.env.MEMBERSHIP_FEE_SEK);
  if (Number.isFinite(override) && override >= 1) return override;
  return MEMBERSHIP_FEE_SEK;
}

/**
 * End of the last calendar year a payment covers — 23:59:59.999 on 31 December,
 * so a membership paid for 2026+2027 is valid through the whole of 2027.
 */
export function membershipPaidUntil(years: number[]): Date {
  const list = years?.length ? years : MEMBERSHIP_YEARS;
  const lastYear = Math.max(...list);
  return new Date(Date.UTC(lastYear, 11, 31, 23, 59, 59, 999));
}

export interface PaidPaymentInput {
  _id: unknown;
  userId: unknown;
  env: string;
  status: string;
  membershipYears: number[];
  datePaid?: Date | null;
}

/**
 * Grants membership for a payment that has reached PAID.
 *
 * The single place that writes membership fields on User — never do it from a
 * request handler. Idempotent: Swish retries a callback up to 10 times, and the
 * reconcile cron can arrive at the same conclusion independently, so this must
 * be safe to run repeatedly for one payment.
 *
 * Returns true when membership is in place afterwards.
 */
export async function applyPaidPayment(
  payment: PaidPaymentInput,
): Promise<boolean> {
  const paymentId = String(payment._id);

  if (payment.status !== "PAID") {
    log.warn("Refusing to grant membership for a non-PAID payment", {
      paymentId,
      status: payment.status,
    });
    return false;
  }

  // The guard that matters: a simulator payment must never buy real membership,
  // and a production payment must not be applied by a sandbox deployment.
  const { env } = getSwishConfig();
  if (payment.env !== env) {
    log.error("Refusing to apply payment from a different Swish environment", {
      paymentId,
      paymentEnv: payment.env,
      runtimeEnv: env,
    });
    return false;
  }

  const user: any = await User.findById(payment.userId).select(
    "membershipStatus membershipPaidUntil membershipFirstPaidAt",
  );
  if (!user) {
    log.error("Paid payment references a user that no longer exists", {
      paymentId,
      userId: String(payment.userId),
    });
    return false;
  }

  const paidUntil = membershipPaidUntil(payment.membershipYears);

  user.membershipStatus = "active";
  // Never shorten an existing membership — a second payment can only extend it.
  if (!user.membershipPaidUntil || user.membershipPaidUntil < paidUntil) {
    user.membershipPaidUntil = paidUntil;
  }
  if (!user.membershipFirstPaidAt) {
    user.membershipFirstPaidAt = payment.datePaid ?? new Date();
  }
  await user.save();

  log.info("Membership granted", {
    paymentId,
    userId: String(payment.userId),
    paidUntil: paidUntil.toISOString(),
  });
  return true;
}
