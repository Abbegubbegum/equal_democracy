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
 *
 * Default span: 70–130% of the municipality's figure. A post can set its own
 * span with `adjustPercent` (e.g. 10 → 90–110%) — set per post in the budget
 * data, since the big posts move far more money per percent than the small.
 */

export interface BudgetRange {
  min: number;
  max: number;
  default: number;
  step: number;
}

interface ExpensePostLike {
  name: string;
  isFixed?: boolean;
  defaultAmount?: number;
  amount?: number;
  minAmount?: number;
  fixedPercentage?: number;
  /** Own span, ± this many percent of the default (overrides 70–130%). */
  adjustPercent?: number;
}

interface IncomePostLike {
  name: string;
  isFixed?: boolean;
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
/** A locked post: counted in the balance, but min = max = its own figure. */
function lockedRange(def: number): BudgetRange {
  return { min: def, max: def, default: def, step: 1 };
}

export function expensePostRange(post: ExpensePostLike): BudgetRange {
  const def = post.defaultAmount || post.amount || 0;
  if (post.isFixed && !isSchoolVoucher(post.name)) return lockedRange(def);
  if (post.adjustPercent) {
    const span = (def * post.adjustPercent) / 100;
    const min = Math.round(def - span);
    const max = Math.round(def + span);
    return { min, max, default: def, step: sliderStep(min, max) };
  }
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
  if (post.isFixed) return lockedRange(def);
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

export interface AlternativeMarker {
  key: string;
  label: string;
  color: string;
  /** In the slider's own unit: kr for a post, kr per hundralapp for tax. */
  value: number;
}

/**
 * The parties' markers for one post's slider. For the tax post the value is
 * the party's tax rate; for any other post its amount. A party without a
 * figure for the post gets no marker.
 */
export function alternativeMarkers(
  alternatives:
    | {
        key: string;
        label: string;
        color: string;
        taxRateKr?: number;
        allocations: { categoryId: string; amount: number }[];
      }[]
    | undefined,
  postId: string,
  taxPost = false,
): AlternativeMarker[] {
  return (alternatives ?? []).flatMap((a) => {
    const value = taxPost
      ? a.taxRateKr
      : a.allocations.find((x) => x.categoryId === postId)?.amount;
    return value == null
      ? []
      : [{ key: a.key, label: a.label, color: a.color, value }];
  });
}
