/**
 * How far each budget post may be adjusted — the single definition shared by
 * the web's sliders (apps/web/components/budget/), the server's vote validation
 * (apps/web/lib/budget/median-calculator.ts) and the app's sliders
 * (apps/mobile/lib/BudgetPostCard.tsx).
 *
 * The rule had drifted: the web slider allowed 70% of the municipality's
 * figure whenever `minAmount` wasn't set below it, but the server rejected
 * anything under `minAmount` — so on a budget whose `minAmount` equals its
 * default (every post in a PDF import that didn't specify one), lowering a post
 * looked possible and then failed to save.
 */

export interface BudgetRange {
  min: number;
  max: number;
  default: number;
  step: number;
}

interface ExpensePostLike {
  name: string;
  defaultAmount?: number;
  amount?: number;
  minAmount?: number;
  fixedPercentage?: number;
}

interface IncomePostLike {
  name: string;
  amount: number;
  defaultAmount?: number;
  minAmount?: number;
  isTaxRate?: boolean;
}

/** Skolpeng and Gymnasieskolpeng are always adjustable to 70–130%. */
export function isSchoolVoucher(name: string): boolean {
  return /skolpeng/i.test(name);
}

export function isTaxIncome(post: { name: string; isTaxRate?: boolean }) {
  return !!post.isTaxRate || post.name.toLowerCase().includes("skatt");
}

function sliderStep(min: number, max: number): number {
  return Math.max(1_000_000, Math.floor((max - min) / 100));
}

/**
 * Minimum on the left, the municipality's figure in the middle, maximum on the
 * right. A `minAmount` below the default is honoured; otherwise 70%.
 */
export function expensePostRange(post: ExpensePostLike): BudgetRange {
  const def = post.defaultAmount || post.amount || 0;
  let min =
    !isSchoolVoucher(post.name) &&
    post.minAmount !== undefined &&
    post.minAmount < def
      ? post.minAmount
      : Math.floor(def * 0.7);
  const max = min + 2 * (def - min);
  const fixed =
    post.fixedPercentage && !isSchoolVoucher(post.name)
      ? (post.fixedPercentage / 100) * def
      : 0;
  if (fixed > 0) min = Math.max(min, fixed);
  return { min, max, default: def, step: sliderStep(min, max) };
}

/** Non-tax income posts: same shape as an expense post. */
export function incomePostRange(post: IncomePostLike): BudgetRange {
  const def = post.defaultAmount || post.amount;
  const min =
    post.minAmount && post.minAmount < def
      ? post.minAmount
      : Math.floor(def * 0.7);
  const max = min + 2 * (def - min);
  return { min, max, default: def, step: sliderStep(min, max) };
}

/**
 * Totals of a proposal, filling any post the proposal leaves out with the
 * municipality's own figure — so leaving a post out can't hide a cost.
 */
export function budgetTotals(
  session: {
    categories: (ExpensePostLike & { id: string })[];
    incomeCategories: (IncomePostLike & { id: string })[];
  },
  vote: {
    allocations?: { categoryId: string; amount: number }[];
    incomeAllocations?: { categoryId: string; amount: number }[];
  },
): { expenses: number; income: number; balance: number } {
  const amountOf = (
    list: { categoryId: string; amount: number }[] | undefined,
    id: string,
  ) => list?.find((a) => a.categoryId === id)?.amount;
  const expenses = session.categories.reduce(
    (sum, c) =>
      sum +
      (amountOf(vote.allocations, c.id) ?? (c.defaultAmount || c.amount || 0)),
    0,
  );
  const income = session.incomeCategories.reduce(
    (sum, c) => sum + (amountOf(vote.incomeAllocations, c.id) ?? c.amount),
    0,
  );
  return { expenses, income, balance: income - expenses };
}

/**
 * A proposal may not spend more than it raises. Allows half a krona of
 * rounding slack, since the client rounds each post to whole kronor.
 */
export function isUnderfunded(balance: number): boolean {
  return balance < -0.5;
}

export interface TaxRange {
  /** Tax base in kr per 1 kr of tax rate: income = rateKr × taxBase. */
  taxBase: number;
  defaultRate: number;
  minRate: number;
  maxRate: number;
  /** 0.01 kr, as on the web. */
  rateStep: number;
}

/**
 * The tax income is set as a tax rate (kr per 100 kr of taxable income).
 * Without a stored tax base it is derived assuming 19 kr — the web's rule.
 */
export function taxIncomeRange(
  post: IncomePostLike,
  session: { taxBase?: number; minTaxRateKr?: number; maxTaxRateKr?: number },
): TaxRange {
  const taxBase = session.taxBase || post.amount / 19;
  const defaultRate = post.amount / taxBase;
  // The session's own bounds apply only alongside a stored tax base, exactly
  // as the web passes `taxRateInfo` only when `taxBase` is set.
  const minRate = session.taxBase
    ? session.minTaxRateKr || 18
    : Math.floor(defaultRate * 0.9 * 100) / 100;
  const maxRate = session.taxBase
    ? session.maxTaxRateKr || 21
    : Math.ceil(defaultRate * 1.1 * 100) / 100;
  return { taxBase, defaultRate, minRate, maxRate, rateStep: 0.01 };
}
