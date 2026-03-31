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
  color: string;
  subcategories: BudgetSubcategory[];
}

export interface BudgetIncomeCategory {
  id: string;
  name: string;
  amount: number;
  color: string;
  isTaxRate: boolean;
  taxRatePercent?: number;
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
}

export interface BudgetVoteAllocation {
  categoryId: string;
  amount: number;
  subcategories: { subcategoryId: string; amount: number }[];
}

export interface BudgetVoteIncomeAllocation {
  categoryId: string;
  amount: number;
  taxRatePercent?: number;
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
  medianTaxRatePercent?: number;
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
