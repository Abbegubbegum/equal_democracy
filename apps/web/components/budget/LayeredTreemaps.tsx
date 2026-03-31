import { useState, useRef } from "react";
import SimpleTreemap from "./SimpleTreemap";

/**
 * Layered Treemaps Component
 * Two treemaps positioned like overlapping cards with offset
 * - Both are always visible, one behind the other
 * - They're offset both horizontally and vertically
 * - Click on the visible part of the back card to bring it to front
 * - Swipe to switch between cards
 * - Click on parenthesis text in header to toggle
 * - The offset remains the same, only Z-position changes
 */
export default function LayeredTreemaps({ expenseCategories, incomeCategories, onExpenseChange, onIncomeChange, taxBaseInfo, onViewModeChange, onCategoryClick }) {
	const containerRef = useRef(null);
	const touchStartX = useRef(0);
	const touchStartY = useRef(0);

	// First, calculate full totals for proportional sizing
	const totalFullExpenses = expenseCategories?.reduce((sum, cat) => sum + (cat.amount || 0), 0) || 0;
	const totalFullIncome = incomeCategories?.reduce((sum, cat) => sum + (cat.amount || 0), 0) || 0;

	// Calculate proportional sizes based on FULL amounts - largest is 100%, smaller scales proportionally
	// Width-based scaling to show budget surplus/deficit horizontally
	// Amplify the difference by 4x to make it visible (since only ~430 mnkr adjustable portion is shown)
	const maxTotal = Math.max(totalFullExpenses, totalFullIncome);
	const difference = Math.abs(totalFullExpenses - totalFullIncome);
	const amplifiedDifference = difference * 4;

	// Calculate width percentages with amplified difference
	const expenseWidthPercent = maxTotal > 0 ? Math.max(20, Math.min(100, (totalFullExpenses / maxTotal) * 100 - (totalFullExpenses < totalFullIncome ? amplifiedDifference / maxTotal * 100 : 0))) : 100;
	const incomeWidthPercent = maxTotal > 0 ? Math.max(20, Math.min(100, (totalFullIncome / maxTotal) * 100 - (totalFullIncome < totalFullExpenses ? amplifiedDifference / maxTotal * 100 : 0))) : 100;

	// Filter expense categories to show only the adjustable portion (30%)
	const filteredExpenseCategories = expenseCategories?.map(cat => ({
		...cat,
		amount: cat.amount * 0.3,
		defaultAmount: (cat.defaultAmount || cat.amount) * 0.3,
	})) || [];

	// Filter income categories - remove Statsbidrag (not adjustable)
	const filteredIncomeCategories = incomeCategories?.map(cat => {
		// Remove Statsbidrag completely (not adjustable)
		if (cat.name.toLowerCase().includes('statsbidrag')) {
			return null;
		}
		return cat;
	}).filter(cat => cat !== null) || [];

	// Use filtered income categories directly without scaling
	const scaledIncomeCategories = filteredIncomeCategories;

	// State for view mode: 'expenses-focus', 'aligned', or 'income-focus'
	// expenses-focus: Full expenses visible, half income visible above
	// aligned: Overlapping for comparison, income transparent
	// income-focus: Full income visible, half expenses visible above
	const [viewMode, setViewMode] = useState('expenses-focus');

	const toggleView = () => {
		// Cycle through three modes: expenses-focus -> aligned -> income-focus -> expenses-focus
		setViewMode(prev => {
			const newMode = prev === 'expenses-focus' ? 'aligned' :
			                prev === 'aligned' ? 'income-focus' :
			                'expenses-focus';

			// Notify parent component of view mode change
			if (onViewModeChange) {
				onViewModeChange(newMode);
			}

			return newMode;
		});
	};

	// Touch handlers for swipe gesture
	const handleTouchStart = (e) => {
		touchStartX.current = e.touches[0].clientX;
		touchStartY.current = e.touches[0].clientY;
		// Prevent default to stop scrolling when touching treemap
		e.preventDefault();
	};

	const handleTouchEnd = (e) => {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;

		const deltaX = touchEndX - touchStartX.current;
		const deltaY = touchEndY - touchStartY.current;

		// Any swipe (up/down/left/right) toggles between the three view modes
		// Reduced threshold for easier swipe detection
		if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
			toggleView();
			e.preventDefault();
		}
	};

	// Calculate balance for header display
	const balance = totalFullIncome - totalFullExpenses;
	const balanceFormatted = (balance / 1000000).toFixed(0); // Convert to mnkr, no decimals
	const balanceColor = balance >= 0 ? 'text-green-600' : 'text-red-600';

	return (
		<div className="bg-white rounded-xl shadow-sm overflow-visible">
			{/* Dynamic balance header */}
			<div className="p-6 pb-4">
				<h2 className={`text-lg font-bold ${balanceColor}`}>
					Balans: {balance > 0 ? '+' : ''}{balanceFormatted} mnkr
				</h2>
			</div>

			{/* Container for overlapping treemaps with swipe support */}
			<div
				ref={containerRef}
				className={`relative p-6 ${
					// Mobile: add margins in offset mode
					viewMode === 'expenses-focus' || viewMode === 'income-focus'
						? 'mt-8 mb-4 md:mt-0 md:mb-4'
						: ''
				}`}
				style={{
					aspectRatio: '16 / 9',
					overflow: 'visible', // Allow treemaps to extend outside container
					touchAction: 'none', // Prevent default touch scrolling on treemap
				}}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				{/* Income Treemap */}
				<div
					onClick={toggleView}
					className={`absolute bg-white rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
						viewMode === 'income-focus' ? "shadow-lg" : "shadow-md"
					} ${
						// Mobile: position from bottom (extends upward)
						// Desktop: position from top (extends downward)
						viewMode === 'expenses-focus'
							? 'bottom-[67%] md:top-0'
							: 'bottom-0 md:bottom-0'
					}`}
					style={{
						left: '50%',
						transform: 'translateX(-50%)',
						width: `${incomeWidthPercent}%`,
						height: '100%',
						// Z-index: income on top in income-focus and aligned modes
						zIndex: viewMode === 'income-focus' ? 10 :
						        viewMode === 'aligned' ? 10 :
						        1, // expenses-focus
						// Opacity: transparent only in aligned mode when on top
						opacity: viewMode === 'aligned' ? 0.5 : 1,
					}}
				>
					<SimpleTreemap categories={scaledIncomeCategories} taxBaseInfo={taxBaseInfo} onCategoryClick={onCategoryClick} />
				</div>

				{/* Expenses Treemap */}
				<div
					onClick={toggleView}
					className={`absolute bg-white rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
						viewMode === 'expenses-focus' ? "shadow-lg" : "shadow-md"
					} ${
						// Mobile: position from bottom (extends upward)
						// Desktop: position from top (extends downward)
						viewMode === 'income-focus'
							? 'bottom-[67%] md:top-0'
							: 'bottom-0 md:bottom-0'
					}`}
					style={{
						left: '50%',
						transform: 'translateX(-50%)',
						width: `${expenseWidthPercent}%`,
						height: '100%',
						// Z-index: expenses on top only in expenses-focus mode
						zIndex: viewMode === 'expenses-focus' ? 10 : 1,
						// Opacity: always 100% (expenses are never transparent)
						opacity: 1,
					}}
				>
					<SimpleTreemap categories={filteredExpenseCategories} taxBaseInfo={null} onCategoryClick={onCategoryClick} />
				</div>
			</div>
		</div>
	);
}
