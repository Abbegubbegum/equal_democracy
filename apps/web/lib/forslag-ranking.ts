import type mongoose from "mongoose";
import { getRatingAggregates } from "./rating-helper";

/**
 * Ranking rules for the Förslag stack (citizen proposals).
 *
 *   score = ratingCount × (averageRating³)   — 1–5 star mean, cubed
 *
 * Proposals are sorted by score descending → rank 1..N. The stack keeps at most
 * MAX_ACTIVE proposals, plus any newcomer still inside its GRACE_DAYS window
 * (a fresh proposal is protected from culling for 10 days so it has time to
 * climb into the top 20). Everything past grace and outside the top 20 is culled
 * (archived) by the daily cron; the current #1 is lifted off as a motion monthly.
 */

export const GRACE_DAYS = 10;
export const MAX_ACTIVE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export function proposalScore(
  ratingCount: number,
  averageRating: number,
): number {
  return ratingCount * Math.pow(averageRating || 0, 3);
}

export interface RankFields {
  score: number;
  ratingCount: number;
  averageRating: number;
  rank: number; // 1-based position in the stack
  ageDays: number; // whole days since createdAt
  inGrace: boolean; // within the 10-day protection window
  atRisk: boolean; // past grace and near the 20-cap boundary
  shouldCull: boolean; // past grace and outside the top 20 → cull
}

/**
 * Enrich a set of active proposals (plain objects with `_id` + `createdAt`)
 * with score/rank/age fields, sorted best-first. Tie-break: older wins.
 */
export function rankActiveProposals<
  T extends { _id: unknown; createdAt: string | Date },
>(
  proposals: T[],
  ratings: Map<string, { averageRating: number; ratingCount: number }>,
  now: Date = new Date(),
): (T & RankFields)[] {
  const enriched = proposals.map((p) => {
    const agg = ratings.get(String(p._id));
    const ratingCount = agg?.ratingCount || 0;
    const averageRating = agg?.averageRating || 0;
    const ageDays = Math.floor(
      (now.getTime() - new Date(p.createdAt).getTime()) / DAY_MS,
    );
    return {
      ...p,
      ratingCount,
      averageRating,
      score: proposalScore(ratingCount, averageRating),
      ageDays,
      inGrace: ageDays < GRACE_DAYS,
      rank: 0,
      atRisk: false,
      shouldCull: false,
    };
  });

  enriched.sort(
    (a, b) =>
      b.score - a.score ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  enriched.forEach((p, i) => {
    p.rank = i + 1;
    p.shouldCull = !p.inGrace && p.rank > MAX_ACTIVE;
    p.atRisk = !p.inGrace && !p.shouldCull && p.rank >= MAX_ACTIVE - 2;
  });

  return enriched as (T & RankFields)[];
}

/**
 * Fetch every active proposal and return it ranked. Shared by the admin API,
 * the daily-cull cron and the monthly-motion job so they all agree on order.
 */
export async function getRankedActiveProposals(
  CitizenProposal: mongoose.Model<any>,
  CitizenProposalRating: mongoose.Model<any>,
  now: Date = new Date(),
) {
  const proposals = await CitizenProposal.find({ status: "active" })
    .select(
      "_id title description authorId imageUrl categories createdAt status",
    )
    .lean();

  const ratings = await getRatingAggregates(
    CitizenProposalRating,
    "proposalId",
    proposals.map((p: any) => p._id),
  );

  return rankActiveProposals(proposals as any[], ratings, now);
}
