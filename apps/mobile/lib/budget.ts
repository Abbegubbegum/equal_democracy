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
