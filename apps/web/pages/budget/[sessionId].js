import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { ArrowLeft, Save, Info, ChevronUp } from "lucide-react";
import LayeredTreemaps from "../../components/budget/LayeredTreemaps";
import CategoryInput from "../../components/budget/CategoryInput";
import IncomeCategoryInput from "../../components/budget/IncomeCategoryInput";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";
import { useTranslation } from "../../lib/hooks/useTranslation";

export default function BudgetVotingPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const { sessionId } = router.query;
	const { t } = useTranslation();

	const [budgetSession, setBudgetSession] = useState(null);
	const [allocations, setAllocations] = useState([]);
	const [incomeAllocations, setIncomeAllocations] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [showInfo, setShowInfo] = useState(false);
	const [viewMode, setViewMode] = useState('expenses-focus');
	const [priorityCategoryId, setPriorityCategoryId] = useState(null);
	const [theme, setTheme] = useState('green');
	const infoBoxRef = useRef(null);
	const touchStartY = useRef(0);

	const initializeAllocations = useCallback((budgetSessionData) => {
		// Initialize allocations with default values
		if (allocations.length === 0) {
			const defaultAllocations = budgetSessionData.categories.map((cat) => ({
				categoryId: cat.id,
				amount: cat.defaultAmount,
				subcategories: [],
			}));
			setAllocations(defaultAllocations);
		}

		if (incomeAllocations.length === 0) {
			const defaultIncomeAllocations = budgetSessionData.incomeCategories.map((cat) => {
				// For tax income, calculate default tax rate if not provided
				const isTaxIncome = cat.isTaxRate || cat.name.toLowerCase().includes("skatt");
				let taxRateKr = cat.taxRateKr || 19; // Default 19 kr

				// If we have amount and taxBase, calculate the rate
				if (isTaxIncome && budgetSessionData.taxBase && cat.amount) {
					taxRateKr = cat.amount / budgetSessionData.taxBase;
				}

				return {
					categoryId: cat.id,
					amount: cat.amount,
					taxRateKr: isTaxIncome ? taxRateKr : undefined,
				};
			});
			setIncomeAllocations(defaultIncomeAllocations);
		}
	}, [allocations.length, incomeAllocations.length]);

	const fetchBudgetSession = useCallback(async () => {
		try {
			setLoading(true);
			const response = await fetch(`/api/budget/sessions`);
			const data = await response.json();

			if (response.ok) {
				const foundSession = data.sessions.find((s) => s.sessionId === sessionId);
				if (foundSession) {
					setBudgetSession(foundSession);
					initializeAllocations(foundSession);
				} else {
					setError("Session not found");
				}
			} else {
				setError(data.message);
			}
		} catch {
			setError("Failed to fetch budget session");
		} finally {
			setLoading(false);
		}
	}, [sessionId, initializeAllocations]);

	const fetchExistingVote = useCallback(async () => {
		try {
			const response = await fetch(`/api/budget/vote?sessionId=${sessionId}`);

			if (response.ok) {
				const data = await response.json();
				setAllocations(data.vote.allocations);
				setIncomeAllocations(data.vote.incomeAllocations);
			}
		} catch {
			// No existing vote, that's okay
		}
	}, [sessionId]);

	useEffect(() => {
		if (status === "loading") return;
		if (!session) {
			router.replace("/login");
			return;
		}
		if (sessionId) {
			fetchBudgetSession();
			fetchExistingVote();
		}
	}, [status, session, sessionId, router, fetchBudgetSession, fetchExistingVote]);

	useEffect(() => {
		// Fetch theme settings
		async function fetchTheme() {
			try {
				const response = await fetch("/api/settings");
				const data = await response.json();
				if (response.ok && data.theme) {
					setTheme(data.theme);
				}
			} catch (fetchError) {
				console.error("Failed to fetch theme:", fetchError);
			}
		}
		fetchTheme();
	}, []);

	const updateAllocation = useCallback((categoryId, newAmount) => {
		setAllocations((prev) => {
			const existing = prev.find((a) => a.categoryId === categoryId);
			if (existing) {
				return prev.map((a) =>
					a.categoryId === categoryId ? { ...a, amount: newAmount } : a
				);
			} else {
				return [
					...prev,
					{ categoryId, amount: newAmount, subcategories: [] },
				];
			}
		});
	}, []);

	const updateIncomeAllocation = useCallback((categoryId, newAmount, taxRateKr) => {
		setIncomeAllocations((prev) => {
			const existing = prev.find((a) => a.categoryId === categoryId);
			if (existing) {
				return prev.map((a) =>
					a.categoryId === categoryId
						? { ...a, amount: newAmount, taxRateKr: taxRateKr || a.taxRateKr }
						: a
				);
			} else {
				return [...prev, { categoryId, amount: newAmount, taxRateKr }];
			}
		});
	}, []);

	// Handlers for treemap pinch gestures
	const handleExpensePinch = useCallback((categoryId, newAmount) => {
		updateAllocation(categoryId, Math.round(newAmount));
	}, [updateAllocation]);

	const handleIncomePinch = useCallback((categoryId, newAmount) => {
		updateIncomeAllocation(categoryId, Math.round(newAmount));
	}, [updateIncomeAllocation]);

	// Handler for category click - move clicked category to top of list
	const handleCategoryClick = useCallback((categoryId) => {
		setPriorityCategoryId(categoryId);
	}, []);

	const handleSaveVote = useCallback(async () => {
		setError("");
		setSuccess("");

		try {
			setSaving(true);

			const totalExpenses = allocations.reduce((sum, a) => sum + a.amount, 0);
			const totalIncome = incomeAllocations.reduce((sum, a) => sum + a.amount, 0);

			const response = await fetchWithCsrf("/api/budget/vote", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId,
					allocations,
					incomeAllocations,
					totalExpenses,
					totalIncome,
				}),
			});

			const data = await response.json();

			if (response.ok) {
				setSuccess(t("budget.proposalSaved"));
				setTimeout(() => setSuccess(""), 5000); // Show for 5 seconds
			} else {
				// Handle validation errors with translations
				if (data.errors && Array.isArray(data.errors)) {
					const translatedErrors = data.errors.map(errorItem => {
						if (errorItem.key && errorItem.params) {
							return t(errorItem.key, errorItem.params);
						}
						return errorItem;
					});
					setError(translatedErrors.join(", "));
				} else {
					setError(data.message || t("budget.failedToSave"));
				}
			}
		} catch {
			setError(t("budget.failedToSave"));
		} finally {
			setSaving(false);
		}
	}, [sessionId, allocations, incomeAllocations, t]);

	// Create updated categories with current allocation amounts for the treemap
	const updatedExpenseCategories = budgetSession?.categories.map(category => {
		const allocation = allocations.find(a => a.categoryId === category.id);
		return {
			...category,
			amount: allocation ? allocation.amount : category.amount
		};
	});

	const updatedIncomeCategories = budgetSession?.incomeCategories.map(category => {
		const allocation = incomeAllocations.find(a => a.categoryId === category.id);
		return {
			...category,
			amount: allocation ? allocation.amount : category.amount
		};
	});

	// Sort categories to put priorityCategoryId first.
	// Override Skolpeng and Gymnasieskolpeng: adjustable at 70–130% of default (default in middle).
	const isSkolpeng = (name) => name && (
		name.toLowerCase().includes('skolpeng') ||
		name.toLowerCase().includes('gymnasieskolpeng')
	);
	const sortedExpenseCategories = budgetSession?.categories ? [...budgetSession.categories]
		.map(cat => {
			if (isSkolpeng(cat.name)) {
				const def = cat.defaultAmount || cat.amount;
				return { ...cat, isFixed: false, fixedPercentage: 0, minAmount: Math.round(def * 0.7) };
			}
			return cat;
		})
		.sort((a, b) => {
			if (a.id === priorityCategoryId) return -1;
			if (b.id === priorityCategoryId) return 1;
			return 0;
		}) : [];

	const sortedIncomeCategories = budgetSession?.incomeCategories ? [...budgetSession.incomeCategories].sort((a, b) => {
		if (a.id === priorityCategoryId) return -1;
		if (b.id === priorityCategoryId) return 1;
		return 0;
	}) : [];

	// Handle swipe up gesture to close info box
	const handleTouchStart = (e) => {
		touchStartY.current = e.touches[0].clientY;
	};

	const handleTouchEnd = (e) => {
		const touchEndY = e.changedTouches[0].clientY;
		const deltaY = touchStartY.current - touchEndY;

		// If swiped up more than 50px, close the info box
		if (deltaY > 50) {
			setShowInfo(false);
		}
	};

	// Get theme color classes
	const getThemeClasses = () => {
		switch (theme) {
			case 'red':
				return {
					bg: 'bg-red-800',
					bgLight: 'bg-red-400',
					text: 'text-red-200',
					textDark: 'text-red-900',
					hover: 'hover:text-white',
					button: 'bg-red-600'
				};
			case 'blue':
				return {
					bg: 'bg-blue-800',
					bgLight: 'bg-blue-400',
					text: 'text-blue-200',
					textDark: 'text-blue-900',
					hover: 'hover:text-white',
					button: 'bg-blue-600'
				};
			case 'green':
			default:
				return {
					bg: 'bg-emerald-800',
					bgLight: 'bg-emerald-400',
					text: 'text-emerald-200',
					textDark: 'text-emerald-900',
					hover: 'hover:text-white',
					button: 'bg-emerald-600'
				};
		}
	};

	const themeColors = getThemeClasses();

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<p className="text-gray-600">{t("budget.loadingSession")}</p>
			</div>
		);
	}

	if (error && !budgetSession) {
		const errorTheme = getThemeClasses();
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<p className="text-red-600 mb-4">{error}</p>
					<button
						onClick={() => router.push("/")}
						className={`px-4 py-2 ${errorTheme.button} text-white rounded-lg`}
					>
						{t("budget.goBack")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<header className={`${themeColors.bg} text-white p-6 shadow`}>
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between mb-4">
						<button
							onClick={() => router.push("/")}
							className={`flex items-center gap-2 ${themeColors.text} ${themeColors.hover}`}
						>
							<ArrowLeft className="w-4 h-4" />
							{t("common.back")}
						</button>
						<div className="flex items-center gap-4">
							<button
								onClick={() => router.push(`/budget/debate/${sessionId}`)}
								className={`${themeColors.text} ${themeColors.hover} font-medium`}
							>
								Till debatten
							</button>
							{session?.user?.isSuperAdmin && (
								<button
									onClick={() => router.push("/budget/admin")}
									className={`${themeColors.text} ${themeColors.hover} font-medium`}
								>
									{t("budget.budgetAdmin")}
								</button>
							)}
						</div>
					</div>
					<h1 className="text-2xl font-bold">
						{budgetSession?.name} {t("budget.title")}
					</h1>
					<button
						onClick={() => setShowInfo(!showInfo)}
						className={`${themeColors.text} ${themeColors.hover} text-sm mt-1 flex items-center gap-1`}
					>
						<Info className="w-4 h-4" />
						{t("budget.information")}
					</button>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6 space-y-6">
				{showInfo && (
					<div
						ref={infoBoxRef}
						className="bg-blue-50 border border-blue-200 rounded-lg p-4 transition-all duration-300"
						onTouchStart={handleTouchStart}
						onTouchEnd={handleTouchEnd}
					>
						<div className="flex items-start gap-3">
							<Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
							<div className="flex-1">
								<ul className="text-sm text-blue-800 space-y-1">
									<li>• {t("budget.infoChartShows")}</li>
									<li>• {t("budget.infoClickBox")}</li>
									<li>• {t("budget.infoAdjustAllocations")}</li>
									<li>• {t("budget.infoMinimumAmounts")}</li>
									<li>• {t("budget.infoIncomeGreater")}</li>
									<li>• {t("budget.infoMedianProposal")}</li>
								</ul>
							</div>
						</div>
						<div className="flex justify-center mt-4 pt-3 border-t border-blue-200">
							<button
								onClick={() => setShowInfo(false)}
								className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
							>
								<ChevronUp className="w-4 h-4" />
								{t("common.close")}
							</button>
						</div>
					</div>
				)}

				{/* Layered Treemap Visualizations */}
				{budgetSession?.incomeCategories && budgetSession.incomeCategories.length > 0 && (
					<LayeredTreemaps
						expenseCategories={updatedExpenseCategories}
						incomeCategories={updatedIncomeCategories}
						onExpenseChange={handleExpensePinch}
						onIncomeChange={handleIncomePinch}
						onViewModeChange={setViewMode}
					onCategoryClick={handleCategoryClick}
						taxBaseInfo={budgetSession.taxBase ? {
							taxBase: budgetSession.taxBase,
							minTaxRateKr: budgetSession.minTaxRateKr || 18,
							maxTaxRateKr: budgetSession.maxTaxRateKr || 21,
						} : null}
					/>
				)}

				{/* Income Categories - shown first when income is in focus */}
				{viewMode === 'income-focus' && (
					<div className="bg-white rounded-xl shadow-sm p-6 mt-2">
						<h2 className="text-lg font-bold text-gray-900 mb-4">
							{t("budget.incomeSources")}
						</h2>
						<div className="space-y-3">
							{sortedIncomeCategories.map((category) => {
								// Tax rate info for 2025: 19 kr = 2135.3 mnkr
								// This means tax base = 2135.3 mnkr / 19 kr = 112.4 million kr
								const taxRateInfo = budgetSession.taxBase
									? {
											taxBase: budgetSession.taxBase,
											defaultTaxRateKr: budgetSession.defaultTaxRateKr || 19,
											minTaxRateKr: budgetSession.minTaxRateKr || 18,
											maxTaxRateKr: budgetSession.maxTaxRateKr || 21,
									  }
									: null;

								return (
									<IncomeCategoryInput
										key={category.id}
										category={category}
										allocation={incomeAllocations.find(
											(a) => a.categoryId === category.id
										)}
										onUpdate={updateIncomeAllocation}
										taxRateInfo={taxRateInfo}
									/>
								);
							})}
						</div>
					</div>
				)}

				{/* Expense Categories - shown first when expenses are in focus */}
				{viewMode === 'expenses-focus' && (
					<div className="bg-white rounded-xl shadow-sm p-6 mt-2">
						<h2 className="text-lg font-bold text-gray-900 mb-4">
							{t("budget.expenseCategories")}
						</h2>
						<div className="space-y-3">
							{sortedExpenseCategories.map((category) => (
								<CategoryInput
									key={category.id}
									category={category}
									allocation={allocations.find((a) => a.categoryId === category.id)}
									onUpdate={updateAllocation}
								/>
							))}
						</div>
					</div>
				)}

				{/* Income Categories - shown second when expenses are in focus */}
				{viewMode === 'expenses-focus' && (
					<div className="bg-white rounded-xl shadow-sm p-6">
						<h2 className="text-lg font-bold text-gray-900 mb-4">
							{t("budget.incomeSources")}
						</h2>
						<div className="space-y-3">
							{sortedIncomeCategories.map((category) => {
								// Tax rate info for 2025: 19 kr = 2135.3 mnkr
								// This means tax base = 2135.3 mnkr / 19 kr = 112.4 million kr
								const taxRateInfo = budgetSession.taxBase
									? {
											taxBase: budgetSession.taxBase,
											defaultTaxRateKr: budgetSession.defaultTaxRateKr || 19,
											minTaxRateKr: budgetSession.minTaxRateKr || 18,
											maxTaxRateKr: budgetSession.maxTaxRateKr || 21,
									  }
									: null;

								return (
									<IncomeCategoryInput
										key={category.id}
										category={category}
										allocation={incomeAllocations.find(
											(a) => a.categoryId === category.id
										)}
										onUpdate={updateIncomeAllocation}
										taxRateInfo={taxRateInfo}
									/>
								);
							})}
						</div>
					</div>
				)}

				{/* Expense Categories - shown second when income is in focus */}
				{viewMode === 'income-focus' && (
					<div className="bg-white rounded-xl shadow-sm p-6">
						<h2 className="text-lg font-bold text-gray-900 mb-4">
							{t("budget.expenseCategories")}
						</h2>
						<div className="space-y-3">
							{sortedExpenseCategories.map((category) => (
								<CategoryInput
									key={category.id}
									category={category}
									allocation={allocations.find((a) => a.categoryId === category.id)}
									onUpdate={updateAllocation}
								/>
							))}
						</div>
					</div>
				)}

				{/* Both categories shown when in aligned mode */}
				{viewMode === 'aligned' && (
					<>
						<div className="bg-white rounded-xl shadow-sm p-6 mt-2 md:mt-2">
							<h2 className="text-lg font-bold text-gray-900 mb-4">
								{t("budget.expenseCategories")}
							</h2>
							<div className="space-y-3">
								{sortedExpenseCategories.map((category) => (
									<CategoryInput
										key={category.id}
										category={category}
										allocation={allocations.find((a) => a.categoryId === category.id)}
										onUpdate={updateAllocation}
									/>
								))}
							</div>
						</div>

						<div className="bg-white rounded-xl shadow-sm p-6">
							<h2 className="text-lg font-bold text-gray-900 mb-4">
								{t("budget.incomeSources")}
							</h2>
							<div className="space-y-3">
								{sortedIncomeCategories.map((category) => {
									const taxRateInfo = budgetSession.taxBase
										? {
												taxBase: budgetSession.taxBase,
												defaultTaxRateKr: budgetSession.defaultTaxRateKr || 19,
												minTaxRateKr: budgetSession.minTaxRateKr || 18,
												maxTaxRateKr: budgetSession.maxTaxRateKr || 21,
										  }
										: null;

									return (
										<IncomeCategoryInput
											key={category.id}
											category={category}
											allocation={incomeAllocations.find(
												(a) => a.categoryId === category.id
											)}
											onUpdate={updateIncomeAllocation}
											taxRateInfo={taxRateInfo}
										/>
									);
								})}
							</div>
						</div>
					</>
				)}

				{/* Success/Error Messages */}
				{error && (
					<div className="bg-red-50 border-2 border-red-500 text-red-800 rounded-lg p-4 font-medium shadow-md flex items-center gap-2">
						<svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
						</svg>
						{error}
					</div>
				)}

				{success && (
					<div className="bg-green-50 border-2 border-green-500 text-green-800 rounded-lg p-4 font-medium shadow-md flex items-center gap-2">
						<svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
						</svg>
						{success}
					</div>
				)}

				{/* Save Button */}
				<div className="flex justify-end">
					<button
						onClick={handleSaveVote}
						disabled={saving}
						className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
					>
						<Save className="w-5 h-5" />
						{saving ? t("budget.saving") : t("budget.saveBudgetProposal")}
					</button>
				</div>
			</main>
		</div>
	);
}
