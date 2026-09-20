/**
 * Shared shape/sorting for the "questions feed" both surfaces serve: the web
 * Hem page + Arkiv's Hem tab (`GET /api/questions`) and the app's Hem/Rösta
 * tabs (`GET /api/mobile/questions`). Extracted because the two endpoints
 * used to duplicate an identical turnout-sort function and display cap, and a
 * change to one silently drifting from the other is exactly the kind of bug
 * lib/vote-quota.ts's central PRE_ELECTION_LIMIT exists to prevent for the
 * voting quota — same reasoning, smaller stakes.
 */

// Closed questions are reachable only via the Hem-feed fallback and the
// archive — both read-only browsing, never vote counting — so a display cap
// is safe and keeps the payload from growing forever as questions accumulate.
export const CLOSED_QUESTION_LIMIT = 100;

/** Sort by total turnout (ja+nej) descending, newest as tie-break. */
export function byTurnout(
  a: { voteCounts: { ja: number; nej: number }; createdAt: Date },
  b: { voteCounts: { ja: number; nej: number }; createdAt: Date },
) {
  const at = a.voteCounts.ja + a.voteCounts.nej;
  const bt = b.voteCounts.ja + b.voteCounts.nej;
  if (bt !== at) return bt - at;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}
