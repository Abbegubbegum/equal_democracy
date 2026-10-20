import type { BaseDocument } from "./base.js";

export type BudgetSessionStatus = "draft" | "active" | "closed";
export type BudgetArgumentDirection = "up" | "down";

export interface BudgetSubcategory {
  id: string;
  name: string;
  defaultAmount: number;
  minAmount: number;
  isFixed: boolean;
}

export interface BudgetCategory {
  id: string;
  name: string;
  defaultAmount: number;
  minAmount: number;
  isFixed: boolean;
  /** Own slider span, ± percent of defaultAmount (default 70–130%). */
  adjustPercent?: number;
  /** Short explanation shown with the post. */
  note?: string | null;
  color: string;
  subcategories: BudgetSubcategory[];
  tags?: string[];
  imageUrl?: string | null;
  totalStars?: number;
  ratingCount?: number;
  averageRating?: number;
}

export interface BudgetIncomeCategory {
  id: string;
  name: string;
  amount: number;
  color: string;
  imageUrl?: string | null;
  /** Counted in the balance but not adjustable (e.g. state grants). */
  isFixed?: boolean;
  isTaxRate: boolean;
  taxRatePercent?: number;
}

/**
 * A party's own budget proposal for the same year, shown as a marker on each
 * slider so a voter can compare their choice with what the parties propose.
 * The session's own posts carry the governing coalition's figures (the
 * slider default); these are the alternatives.
 */
export interface BudgetAlternative {
  /** Short party name shown on the marker, e.g. "S". */
  key: string;
  label: string;
  /** Marker colour. */
  color: string;
  /** The party's tax rate, kr per hundralapp. */
  taxRateKr?: number;
  /** The party's amount per post (kr). A post it has no figure for is left out. */
  allocations: { categoryId: string; amount: number }[];
}

export interface BudgetSession extends BaseDocument {
  sessionId: string;
  name: string;
  municipality: string;
  totalBudget: number;
  status: BudgetSessionStatus;
  createdBy: string;
  startDate?: string;
  endDate?: string;
  taxBase?: number;
  defaultTaxRateKr: number;
  minTaxRateKr: number;
  maxTaxRateKr: number;
  categories: BudgetCategory[];
  incomeCategories: BudgetIncomeCategory[];
  alternatives?: BudgetAlternative[];
}

export interface BudgetVoteAllocation {
  categoryId: string;
  amount: number;
  subcategories: { subcategoryId: string; amount: number }[];
}

export interface BudgetVoteIncomeAllocation {
  categoryId: string;
  amount: number;
  /** Tax post only: kronor per hundred kronor of taxable income. */
  taxRateKr?: number;
}

export interface BudgetVote extends BaseDocument {
  sessionId: string;
  userId: string;
  allocations: BudgetVoteAllocation[];
  incomeAllocations: BudgetVoteIncomeAllocation[];
  totalExpenses: number;
  totalIncome: number;
}

export interface BudgetMedianAllocation {
  categoryId: string;
  medianAmount: number;
  percentageOfTotal: number;
  subcategories: {
    subcategoryId: string;
    medianAmount: number;
    percentageOfCategory: number;
  }[];
}

export interface BudgetMedianIncomeAllocation {
  categoryId: string;
  medianAmount: number;
  medianTaxRateKr?: number;
}

export interface BudgetResult extends BaseDocument {
  sessionId: string;
  medianAllocations: BudgetMedianAllocation[];
  medianIncomeAllocations: BudgetMedianIncomeAllocation[];
  totalMedianExpenses: number;
  totalMedianIncome: number;
  balancedExpenses: number;
  voterCount: number;
  calculatedAt: string;
}

export interface BudgetArgument extends BaseDocument {
  sessionId: string;
  userId: string;
  userName: string;
  categoryId: string;
  categoryName: string;
  direction: BudgetArgumentDirection;
  text: string;
  helpfulVotes: string[];
  isHidden: boolean;
}

export interface BudgetCategoryRating extends BaseDocument {
  sessionId: string;
  categoryId: string;
  userId: string;
  rating: number;
}
