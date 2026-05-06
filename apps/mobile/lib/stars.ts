import { getItem, setItem } from "./storage";

const STARS_KEY = "user_stars";
const FIRST_VISIT_KEY = "celebrated_first_visit";
const INTERESTS_SET_KEY = "celebrated_interests_set";

export async function getStars(): Promise<number> {
  try {
    const val = await getItem(STARS_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export async function addStars(n: number): Promise<number> {
  const current = await getStars();
  const next = current + n;
  await setItem(STARS_KEY, String(next));
  return next;
}

export async function isFirstVisit(): Promise<boolean> {
  const seen = await getItem(FIRST_VISIT_KEY);
  return !seen;
}

export async function markFirstVisitSeen(): Promise<void> {
  await setItem(FIRST_VISIT_KEY, "1");
}

export async function isFirstInterestsSave(): Promise<boolean> {
  const seen = await getItem(INTERESTS_SET_KEY);
  return !seen;
}

export async function markInterestsSaved(): Promise<void> {
  await setItem(INTERESTS_SET_KEY, "1");
}
