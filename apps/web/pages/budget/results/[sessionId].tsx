import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { ArrowLeft, Users, TrendingUp, DollarSign } from "lucide-react";
import TreemapViz from "../../../components/budget/TreemapViz";

export default function BudgetResultsPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { sessionId } = router.query;

	const [budgetSession, setBudgetSession] = useState(null);
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const fetchResults = useCallback(async () => {
		try {
			setLoading(true);
			const response = await fetch(`/api/budget/results?sessionId=${sessionId}`);
			const data = await response.json();

			if (response.ok) {
				setBudgetSession(data.session);
				setResult(data.result);
			} else {
				setError(data.message);
			}
		} catch {
			setError("Failed to fetch results");
		} finally {
			setLoading(false);
		}
	}, [sessionId]);

	useEffect(() => {
		if (status === "loading") return;
		if (!session) {
			router.replace("/login");
			return;
		}
		if (sessionId) {
			fetchResults();
		}
	}, [status, session, sessionId, router, fetchResults]);

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<p className="text-gray-600">Loading results...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-red-600 mb-4">{error}</p>
					<button
						onClick={() => router.push("/")}
						className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
					>
						Go Back
					</button>
				</div>
			</div>
		);
	}

	// Convert median allocations to format expected by TreemapViz
	const medianAllocations = result?.medianAllocations?.map((allocation) => ({
		categoryId: allocation.categoryId,
		amount: allocation.medianAmount,
		subcategories: allocation.subcategories?.map((sub) => ({
			subcategoryId: sub.subcategoryId,
			amount: sub.medianAmount,
		})) || [],
	})) || [];

	const medianIncomeAllocations = result?.medianIncomeAllocations?.map((allocation) => ({
		categoryId: allocation.categoryId,
		amount: allocation.medianAmount,
		taxRatePercent: allocation.medianTaxRatePercent,
	})) || [];

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-emerald-800 text-white p-6 shadow">
				<div className="max-w-6xl mx-auto">
					<button
						onClick={() => router.push("/budget/admin")}
						className="flex items-center gap-2 text-emerald-200 hover:text-white mb-4"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Admin
					</button>
					<h1 className="text-2xl font-bold">Budget Results</h1>
					<p className="text-emerald-200 text-sm mt-1">
						{budgetSession?.name} • {budgetSession?.municipality}
					</p>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				{/* Results Summary */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="bg-white rounded-xl shadow-sm p-6">
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
								<Users className="w-5 h-5 text-blue-600" />
							</div>
							<h3 className="font-semibold text-gray-900">Participants</h3>
						</div>
						<p className="text-3xl font-bold text-gray-900">{result?.voterCount || 0}</p>
						<p className="text-sm text-gray-500 mt-1">Budget proposals submitted</p>
					</div>

					<div className="bg-white rounded-xl shadow-sm p-6">
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
								<TrendingUp className="w-5 h-5 text-green-600" />
							</div>
							<h3 className="font-semibold text-gray-900">Total Income</h3>
						</div>
						<p className="text-3xl font-bold text-gray-900">
							{(result?.totalMedianIncome / 1000000).toFixed(1)}
						</p>
						<p className="text-sm text-gray-500 mt-1">Million kronor (median)</p>
					</div>

					<div className="bg-white rounded-xl shadow-sm p-6">
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
								<DollarSign className="w-5 h-5 text-emerald-600" />
							</div>
							<h3 className="font-semibold text-gray-900">Total Expenses</h3>
						</div>
						<p className="text-3xl font-bold text-gray-900">
							{(result?.balancedExpenses / 1000000).toFixed(1)}
						</p>
						<p className="text-sm text-gray-500 mt-1">Million kronor (balanced)</p>
					</div>
				</div>

				{/* Information Box */}
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
					<h3 className="font-semibold text-blue-900 mb-2">About These Results</h3>
					<p className="text-sm text-blue-800">
						These results represent the collective median budget. The median value was
						calculated for each category across all {result?.voterCount} proposals, then
						expense percentages were balanced to match the total median income. This
						ensures a fiscally responsible budget that reflects the community's priorities.
					</p>
				</div>

				{/* Median Budget Visualization */}
				<div className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-bold text-gray-900 mb-4">
						Collective Median Budget
					</h2>
					<TreemapViz
						session={budgetSession}
						allocations={medianAllocations}
						incomeAllocations={medianIncomeAllocations}
						readOnly={true}
					/>
				</div>

				{/* Detailed Breakdown */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Expense Breakdown */}
					<div className="bg-white rounded-xl shadow-sm p-6">
						<h2 className="text-lg font-bold text-gray-900 mb-4">
							Expense Breakdown
						</h2>
						<div className="space-y-3">
							{result?.medianAllocations?.map((allocation) => {
								const category = budgetSession?.categories?.find(
									(c) => c.id === allocation.categoryId
								);
								return (
									<div
										key={allocation.categoryId}
										className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
									>
										<div className="flex-1">
											<h3 className="font-medium text-gray-900">
												{category?.name}
											</h3>
											<p className="text-xs text-gray-500">
												{allocation.percentageOfTotal.toFixed(1)}% of total
											</p>
										</div>
										<div className="text-right">
											<p className="font-semibold text-gray-900">
												{(allocation.medianAmount / 1000000).toFixed(1)} mnkr
											</p>
										</div>
									</div>
								);
							})}
						</div>
						<div className="mt-4 pt-4 border-t border-gray-200">
							<div className="flex items-center justify-between font-bold">
								<span>Total Expenses</span>
								<span>{(result?.balancedExpenses / 1000000).toFixed(1)} mnkr</span>
							</div>
						</div>
					</div>

					{/* Income Breakdown */}
					<div className="bg-white rounded-xl shadow-sm p-6">
						<h2 className="text-lg font-bold text-gray-900 mb-4">
							Income Breakdown
						</h2>
						<div className="space-y-3">
							{result?.medianIncomeAllocations?.map((allocation) => {
								const category = budgetSession?.incomeCategories?.find(
									(c) => c.id === allocation.categoryId
								);
								return (
									<div
										key={allocation.categoryId}
										className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
									>
										<div className="flex-1">
											<h3 className="font-medium text-gray-900">
												{category?.name}
											</h3>
											{allocation.medianTaxRatePercent && (
												<p className="text-xs text-gray-500">
													Tax rate: {allocation.medianTaxRatePercent.toFixed(2)}%
												</p>
											)}
										</div>
										<div className="text-right">
											<p className="font-semibold text-gray-900">
												{(allocation.medianAmount / 1000000).toFixed(1)} mnkr
											</p>
										</div>
									</div>
								);
							})}
						</div>
						<div className="mt-4 pt-4 border-t border-gray-200">
							<div className="flex items-center justify-between font-bold">
								<span>Total Income</span>
								<span>{(result?.totalMedianIncome / 1000000).toFixed(1)} mnkr</span>
							</div>
						</div>
					</div>
				</div>

				{/* Export Options */}
				<div className="bg-white rounded-xl shadow-sm p-6">
					<h2 className="text-lg font-bold text-gray-900 mb-4">Export Results</h2>
					<div className="flex gap-3">
						<button
							onClick={() => {
								const json = JSON.stringify(result, null, 2);
								const blob = new Blob([json], { type: "application/json" });
								const url = URL.createObjectURL(blob);
								const a = document.createElement("a");
								a.href = url;
								a.download = `budget-results-${sessionId}.json`;
								a.click();
							}}
							className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
						>
							Download JSON
						</button>
						<button
							onClick={() => {
								navigator.clipboard.writeText(JSON.stringify(result, null, 2));
								alert("Results copied to clipboard!");
							}}
							className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
						>
							Copy to Clipboard
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
