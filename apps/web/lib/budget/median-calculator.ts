import {
  budgetTotals,
  expensePostRange,
  isTaxIncome,
  isUnderfunded,
  taxIncomeRange,
} from "@repo/types";

/**
 * Median Budget Calculator
 * Calculates the collective median budget from individual votes
 */

/**
 * Calculate median value from an array of numbers
 * @param {number[]} values - Array of numbers
 * @returns {number} - Median value
 */
function calculateMedian(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate median budget from all votes
 * @param {Array} votes - Array of BudgetVote documents
 * @param {Object} session - BudgetSession document
 * @returns {Object} - Median budget result
 */
export function calculateMedianBudget(votes, session) {
  if (!votes || votes.length === 0) {
    throw new Error("No votes to calculate median from");
  }

  // 1. Calculate median for all income categories
  const medianIncomeAllocations = [];
  let totalMedianIncome = 0;

  for (const incomeCategory of session.incomeCategories) {
    const amounts = votes
      .map((vote) => {
        const allocation = vote.incomeAllocations.find(
          (a) => a.categoryId === incomeCategory.id,
        );
        return allocation ? allocation.amount : 0;
      })
      .filter((amount) => amount !== null && amount !== undefined);

    const medianAmount = calculateMedian(amounts);

    // For the tax post, also the median tax rate (kr per hundralapp). Read
    // from `taxRateKr`, the field the sliders actually send — this used to
    // read `taxRatePercent`, which nothing ever wrote, so the stored median
    // rate was always empty.
    let medianTaxRateKr = null;
    if (isTaxIncome(incomeCategory)) {
      const taxRates = votes
        .map((vote) => {
          const allocation = vote.incomeAllocations.find(
            (a) => a.categoryId === incomeCategory.id,
          );
          if (!allocation) return null;
          // Proposals saved before taxRateKr was stored carry only the
          // amount; the rate follows from it exactly as the slider computes
          // it (amount = rate × tax base).
          return (
            allocation.taxRateKr ??
            allocation.amount / taxIncomeRange(incomeCategory, session).taxBase
          );
        })
        .filter((rate) => rate !== null && rate !== undefined);

      medianTaxRateKr = taxRates.length ? calculateMedian(taxRates) : null;
    }

    medianIncomeAllocations.push({
      categoryId: incomeCategory.id,
      medianAmount,
      medianTaxRateKr,
    });

    totalMedianIncome += medianAmount;
  }

  // 2. Calculate median for all expense categories
  const medianAllocations = [];
  let totalMedianExpenses = 0;

  for (const category of session.categories) {
    const amounts = votes
      .map((vote) => {
        const allocation = vote.allocations.find(
          (a) => a.categoryId === category.id,
        );
        return allocation ? allocation.amount : 0;
      })
      .filter((amount) => amount !== null && amount !== undefined);

    const medianAmount = calculateMedian(amounts);
    totalMedianExpenses += medianAmount;

    // Calculate median for subcategories
    const subcategories = [];
    for (const subcategory of category.subcategories || []) {
      const subAmounts = votes
        .map((vote) => {
          const allocation = vote.allocations.find(
            (a) => a.categoryId === category.id,
          );
          if (!allocation) return 0;

          const subAllocation = allocation.subcategories.find(
            (s) => s.subcategoryId === subcategory.id,
          );
          return subAllocation ? subAllocation.amount : 0;
        })
        .filter((amount) => amount !== null && amount !== undefined);

      const medianSubAmount = calculateMedian(subAmounts);

      subcategories.push({
        subcategoryId: subcategory.id,
        medianAmount: medianSubAmount,
        percentageOfCategory:
          medianAmount > 0 ? (medianSubAmount / medianAmount) * 100 : 0,
      });
    }

    medianAllocations.push({
      categoryId: category.id,
      medianAmount,
      percentageOfTotal: 0, // Will be calculated after balancing
      subcategories,
    });
  }

  // 3. Convert expenses to percentages
  const expensePercentages = medianAllocations.map((allocation) => ({
    ...allocation,
    percentageOfTotal:
      totalMedianExpenses > 0
        ? (allocation.medianAmount / totalMedianExpenses) * 100
        : 0,
  }));

  // 4. Balance expenses to match income
  // Scale all expense percentages so they sum to totalMedianIncome
  const balancedExpenses = totalMedianIncome;

  const balancedAllocations = expensePercentages.map((allocation) => ({
    ...allocation,
    medianAmount: (allocation.percentageOfTotal / 100) * balancedExpenses,
  }));

  return {
    medianAllocations: balancedAllocations,
    medianIncomeAllocations,
    totalMedianExpenses,
    totalMedianIncome,
    balancedExpenses,
    voterCount: votes.length,
  };
}

/**
 * Validate that a budget vote respects minimum amounts
 * @param {Object} vote - BudgetVote data
 * @param {Object} session - BudgetSession document
 * @returns {Object} - { valid: boolean, errors: Array<{key: string, params: object}> }
 */
export function validateBudgetVote(vote, session) {
  const errors = [];

  // Check expense allocations
  for (const allocation of vote.allocations) {
    const category = session.categories.find(
      (c) => c.id === allocation.categoryId,
    );

    if (!category) {
      errors.push({
        key: "budget.validation.categoryNotFound",
        params: { categoryId: allocation.categoryId },
      });
      continue;
    }

    // Same bounds the sliders offer (web and app) — the raw minAmount used
    // to be checked here, which rejected every reduction on a budget whose
    // minAmount equals its default even though the slider allowed it. The
    // upper bound was never checked at all, and a locked post (min = max)
    // must stay at its own figure.
    const { min, max } = expensePostRange(category);
    if (allocation.amount > max + 0.5) {
      errors.push({
        key: "budget.validation.aboveMaximum",
        params: {
          category: category.name,
          amount: (allocation.amount / 1000000).toFixed(2),
          maximum: (max / 1000000).toFixed(2),
        },
      });
    }
    if (allocation.amount < min - 0.5) {
      errors.push({
        key: "budget.validation.belowMinimum",
        params: {
          category: category.name,
          amount: (allocation.amount / 1000000).toFixed(2),
          minimum: (min / 1000000).toFixed(2),
        },
      });
    }

    // Check subcategories
    for (const subAllocation of allocation.subcategories || []) {
      const subcategory = category.subcategories.find(
        (s) => s.id === subAllocation.subcategoryId,
      );

      if (!subcategory) {
        errors.push({
          key: "budget.validation.subcategoryNotFound",
          params: { subcategoryId: subAllocation.subcategoryId },
        });
        continue;
      }

      if (subAllocation.amount < subcategory.minAmount) {
        errors.push({
          key: "budget.validation.subcategoryBelowMinimum",
          params: {
            category: category.name,
            subcategory: subcategory.name,
            amount: (subAllocation.amount / 1000000).toFixed(2),
            minimum: (subcategory.minAmount / 1000000).toFixed(2),
          },
        });
      }
    }
  }

  // No proposal may spend more than it raises. Computed here from the posts
  // themselves — the client's totalExpenses/totalIncome are never trusted.
  const { balance } = budgetTotals(session, vote);
  if (isUnderfunded(balance)) {
    errors.push({
      key: "budget.validation.underfunded",
      params: { deficit: (-balance / 1000000).toFixed(1) },
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
