import { apiClient } from "./api";
import type {
  VoteCounts,
  VotingSession,
  VotingQuota,
} from "./VotingQuestionCard";

/**
 * Shared in-memory cache for GET /api/mobile/questions.
 *
 * Hem and Rösta both render off the exact same payload, and Hem always fetches
 * it moments before navigating to Rösta. Without a shared cache, Rösta refetched
 * the whole list to display the single question the user had just picked — a
 * second identical round trip, with a full-screen LoadingLoop gated on it.
 *
 * Both screens now render cached data immediately and revalidate in the
 * background, and concurrent callers share one in-flight request.
 */
export type QuestionsPayload = {
  questions: VotingSession[];
  quota: VotingQuota | null;
};

let cache: QuestionsPayload | null = null;
let inflight: Promise<QuestionsPayload> | null = null;

const listeners = new Set<(payload: QuestionsPayload) => void>();

function emit() {
  if (!cache) return;
  for (const listener of listeners) listener(cache);
}

/** Whatever was last fetched, or null on a cold start. */
export function getCachedQuestions(): QuestionsPayload | null {
  return cache;
}

/**
 * Fetch the question list, de-duplicating concurrent calls. Hem and Rösta both
 * fire on focus, and a tab switch can focus one while the other's request is
 * still open — they share it instead of racing.
 */
export async function fetchQuestions(): Promise<QuestionsPayload> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const data = await apiClient<{
        questions: VotingSession[];
        quota: VotingQuota;
      }>("/api/mobile/questions");
      cache = {
        questions: data?.questions ?? [],
        quota: data?.quota ?? null,
      };
      emit();
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Fold a cast vote into the cache so Hem drops the question from its unvoted
 * feed without waiting for a refetch.
 */
export function applyVoteToCache(
  questionId: string,
  voteCounts: VoteCounts,
  userVote: VotingSession["userVote"],
  isNewVote: boolean,
) {
  if (!cache) return;
  cache = {
    questions: cache.questions.map((q) =>
      q.id === questionId ? { ...q, voteCounts, userVote } : q,
    ),
    quota:
      cache.quota && isNewVote
        ? { ...cache.quota, used: cache.quota.used + 1 }
        : cache.quota,
  };
  emit();
}

/** Drop everything — the next reader must refetch. Called on logout. */
export function clearQuestionsCache() {
  cache = null;
}

/** Subscribe to cache updates; returns an unsubscribe function. */
export function onQuestionsChange(
  listener: (payload: QuestionsPayload) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
