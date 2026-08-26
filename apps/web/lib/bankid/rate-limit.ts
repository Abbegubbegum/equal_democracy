/**
 * Throttle on starting BankID orders.
 *
 * Unlike most rate limits this one is about money as much as abuse: every
 * accepted order is a billable signature against a real identity, and there is
 * no sandbox to absorb mistakes. A loop calling the start endpoint would spend
 * real money as fast as it could open connections.
 *
 * Counted in the database rather than in memory, because a Vercel deployment
 * runs many lambda instances and an in-process counter would reset on every
 * cold start and be per-instance in between. `VoteVerification` already records
 * exactly what needs counting, so this needs no new collection — and its TTL
 * keeps the window's data around far longer than the window itself.
 *
 * The in-flight resume in the start endpoints handles the common accidental
 * case (a double tap on the same ballot). This catches the rest.
 */

import { VoteVerification } from "../models";

/**
 * Generous against real use, tight against a loop. A voter has at most five
 * votes to cast, and even a retry-heavy session — cancel, restart, sign again —
 * stays well inside this.
 */
export const MAX_STARTS_PER_HOUR = 10;

const WINDOW_MS = 60 * 60 * 1000;

export interface ThrottleResult {
  limited: boolean;
  /** Seconds until the oldest order in the window falls out of it. */
  retryAfter: number;
}

export async function checkStartThrottle(
  userId: string,
): Promise<ThrottleResult> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const recent = await VoteVerification.countDocuments({
    userId,
    createdAt: { $gt: windowStart },
  });

  if (recent < MAX_STARTS_PER_HOUR) return { limited: false, retryAfter: 0 };

  // Retry becomes possible when the oldest order in the window ages out, not
  // an hour from now — telling someone to wait longer than they must is its own
  // small failure.
  const oldest: any = await VoteVerification.findOne({
    userId,
    createdAt: { $gt: windowStart },
  })
    .sort({ createdAt: 1 })
    .select("createdAt")
    .lean();

  const retryAfter = oldest
    ? Math.max(
        1,
        Math.ceil(
          (new Date(oldest.createdAt).getTime() + WINDOW_MS - Date.now()) /
            1000,
        ),
      )
    : 60;

  return { limited: true, retryAfter };
}
