import type { BudgetAlternative } from "@repo/types";
import { apiClient } from "./api";

/**
 * Client for the budget module. Reuses the web's budget API as-is — there are
 * no mobile-specific budget routes. Only one budget process is ever active at
 * a time, which is the one the Hem card and the Rösta budget view show.
 */
export interface BudgetExpensePost {
  id: string;
  name: string;
  defaultAmount: number;
  minAmount?: number;
  fixedPercentage?: number;
  /** Own slider span, ± percent of defaultAmount (default 70–130%). */
  adjustPercent?: number;
  /** Short explanation shown with the post. */
  note?: string | null;
  color?: string;
  imageUrl?: string | null;
  isFixed?: boolean;
}

export interface BudgetIncomePost {
  id: string;
  name: string;
  amount: number;
  color?: string;
  imageUrl?: string | null;
  isTaxRate?: boolean;
  isFixed?: boolean;
}

export interface BudgetSessionSummary {
  sessionId: string;
  name: string;
  municipality: string;
  totalBudget: number;
  status: "draft" | "active" | "closed";
  startDate?: string;
  endDate?: string | null;
  categories: BudgetExpensePost[];
  incomeCategories: BudgetIncomePost[];
  taxBase?: number;
  minTaxRateKr?: number;
  maxTaxRateKr?: number;
  /** The parties' own proposals — markers on the sliders. */
  alternatives?: BudgetAlternative[];
}

/** The signed-in user's saved budget proposal (web: BudgetVote). */
export interface BudgetVote {
  allocations: { categoryId: string; amount: number }[];
  incomeAllocations: {
    categoryId: string;
    amount: number;
    taxRateKr?: number;
  }[];
}

/**
 * The active budget process, or null when none is running. Same rule as the
 * web's /budget landing: newest active session (the API sorts createdAt desc).
 */
export async function fetchActiveBudget(): Promise<BudgetSessionSummary | null> {
  const data = await apiClient<{ sessions: BudgetSessionSummary[] }>(
    "/api/budget/sessions?status=active",
  );
  return data?.sessions?.[0] ?? null;
}

/**
 * The user's own saved proposal for this budget, or null — none saved yet, or
 * not signed in / not allowed to take part. Never throws: the budget is
 * readable without a proposal, starting from the municipality's figures.
 */
export async function fetchMyBudgetVote(
  sessionId: string,
): Promise<BudgetVote | null> {
  try {
    const data = await apiClient<{ vote: BudgetVote }>(
      `/api/budget/vote?sessionId=${encodeURIComponent(sessionId)}`,
    );
    return data?.vote ?? null;
  } catch {
    return null;
  }
}

/**
 * The collective proposal of a closed budget — the server's median of every
 * saved proposal (apps/web/lib/budget/median-calculator.ts), whether it was
 * made on the web or in the app.
 */
export interface BudgetResultSummary {
  session: BudgetSessionSummary;
  voterCount: number;
  totalIncome: number;
  balancedExpenses: number;
  /** Median tax rate, kronor per hundralapp; null if nobody set one. */
  taxRateKr: number | null;
}

async function fetchResult(
  session: BudgetSessionSummary,
): Promise<BudgetResultSummary | null> {
  try {
    const data = await apiClient<{
      result: {
        voterCount: number;
        totalMedianIncome: number;
        balancedExpenses: number;
        medianIncomeAllocations: {
          categoryId: string;
          medianTaxRateKr?: number | null;
        }[];
      };
    }>(
      `/api/budget/results?sessionId=${encodeURIComponent(session.sessionId)}`,
    );
    const r = data.result;
    const tax = r.medianIncomeAllocations.find(
      (a) => a.medianTaxRateKr != null,
    );
    return {
      session,
      voterCount: r.voterCount,
      totalIncome: r.totalMedianIncome,
      balancedExpenses: r.balancedExpenses,
      taxRateKr: tax?.medianTaxRateKr ?? null,
    };
  } catch {
    // 404: closed without a single proposal — there is no result to show.
    return null;
  }
}

/**
 * Every closed budget that has a result, newest first — the Arkiv "Budget"
 * tab. Budgets are one per year, so one results call each is fine.
 */
export async function fetchBudgetResults(): Promise<BudgetResultSummary[]> {
  const data = await apiClient<{ sessions: BudgetSessionSummary[] }>(
    "/api/budget/sessions?status=closed",
  );
  const results = await Promise.all((data?.sessions ?? []).map(fetchResult));
  return results.filter((r): r is BudgetResultSummary => r !== null);
}

/**
 * The newest closed budget's result — what Hem shows between budget rounds,
 * the way it shows closed questions' results until new ones are published.
 */
export async function fetchLatestBudgetResult(): Promise<BudgetResultSummary | null> {
  const data = await apiClient<{ sessions: BudgetSessionSummary[] }>(
    "/api/budget/sessions?status=closed",
  );
  for (const session of data?.sessions ?? []) {
    const result = await fetchResult(session);
    if (result) return result;
  }
  return null;
}

/** "19,00 kr per hundralapp" */
export function formatTaxRate(kr: number): string {
  return `${kr.toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr per hundralapp`;
}

/**
 * Saves the user's proposal through the web's own endpoint — the same
 * validation (lib/budget/median-calculator.ts) and the same median it feeds.
 */
export async function saveBudgetVote(
  sessionId: string,
  vote: BudgetVote,
): Promise<void> {
  const totalExpenses = vote.allocations.reduce((s, a) => s + a.amount, 0);
  const totalIncome = vote.incomeAllocations.reduce((s, a) => s + a.amount, 0);
  await apiClient("/api/budget/vote", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      allocations: vote.allocations.map((a) => ({ ...a, subcategories: [] })),
      incomeAllocations: vote.incomeAllocations,
      totalExpenses,
      totalIncome,
    }),
  });
}

/** "1 234 567 kr" — Swedish grouping, no decimals. */
export function formatSek(amount: number): string {
  return `${Math.round(amount).toLocaleString("sv-SE")} kr`;
}

/** "292,6 mnkr" — the unit the web's budget diagram uses. */
export function formatMnkr(amount: number): string {
  return `${(amount / 1_000_000).toLocaleString("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mnkr`;
}
