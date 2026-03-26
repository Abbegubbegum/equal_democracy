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
          (a) => a.categoryId === incomeCategory.id
        );
        return allocation ? allocation.amount : 0;
      })
      .filter((amount) => amount !== null && amount !== undefined);

    const medianAmount = calculateMedian(amounts);

    // For tax rate categories, also calculate median tax rate
    let medianTaxRatePercent = null;
    if (incomeCategory.isTaxRate) {
      const taxRates = votes
        .map((vote) => {
          const allocation = vote.incomeAllocations.find(
            (a) => a.categoryId === incomeCategory.id
          );
          return allocation ? allocation.taxRatePercent : null;
        })
        .filter((rate) => rate !== null && rate !== undefined);

      medianTaxRatePercent = calculateMedian(taxRates);
    }

    medianIncomeAllocations.push({
      categoryId: incomeCategory.id,
      medianAmount,
      medianTaxRatePercent,
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
          (a) => a.categoryId === category.id
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
            (a) => a.categoryId === category.id
          );
          if (!allocation) return 0;

          const subAllocation = allocation.subcategories.find(
            (s) => s.subcategoryId === subcategory.id
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
      (c) => c.id === allocation.categoryId
    );

    if (!category) {
      errors.push({
        key: "budget.validation.categoryNotFound",
        params: { categoryId: allocation.categoryId },
      });
      continue;
    }

    // Check minimum amount for category
    if (allocation.amount < category.minAmount) {
      errors.push({
        key: "budget.validation.belowMinimum",
        params: {
          category: category.name,
          amount: (allocation.amount / 1000000).toFixed(2),
          minimum: (category.minAmount / 1000000).toFixed(2),
        },
      });
    }

    // Check subcategories
    for (const subAllocation of allocation.subcategories || []) {
      const subcategory = category.subcategories.find(
        (s) => s.id === subAllocation.subcategoryId
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

  return {
    valid: errors.length === 0,
    errors,
  };
}
