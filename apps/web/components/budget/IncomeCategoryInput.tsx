import { useState, useEffect } from "react";

/**
 * Tax Income Sliders Component
 * Shows TWO synchronized sliders for tax income:
 * 1. Skattesats (tax rate in kr)
 * 2. Skatteintäkter (tax income in mnkr)
 * Both sliders move in parallel and are calculated from each other
 */
function TaxIncomeSliders({ category, allocation, onUpdate, taxBase, taxRateInfo, readOnly }) {
	// Calculate default tax rate from amount and taxBase
	const defaultTaxRate = category.amount / taxBase;
	const minTaxRate = taxRateInfo?.minTaxRateKr || Math.floor(defaultTaxRate * 0.9 * 100) / 100;
	const maxTaxRate = taxRateInfo?.maxTaxRateKr || Math.ceil(defaultTaxRate * 1.1 * 100) / 100;

	// State: we store the tax rate (kr), and calculate amount from it
	const [taxRateKr, setTaxRateKr] = useState(allocation?.taxRateKr || defaultTaxRate);
	const [isEditingRate, setIsEditingRate] = useState(false);
	const [isEditingAmount, setIsEditingAmount] = useState(false);
	const [editValueRate, setEditValueRate] = useState("");
	const [editValueAmount, setEditValueAmount] = useState("");

	// Calculate amount from tax rate
	const calculatedAmount = taxRateKr * taxBase;

	// Sync with allocation
	useEffect(() => {
		if (allocation?.taxRateKr !== undefined) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setTaxRateKr(allocation.taxRateKr);
		}
	}, [allocation?.taxRateKr]);

	// Handler for tax rate slider
	function handleTaxRateSliderChange(e) {
		const newRate = parseFloat(e.target.value);
		setTaxRateKr(newRate);
		const newAmount = newRate * taxBase;
		onUpdate(category.id, newAmount, newRate);
	}

	// Handler for amount slider
	function handleAmountSliderChange(e) {
		const newAmount = parseFloat(e.target.value);
		const newRate = newAmount / taxBase;
		setTaxRateKr(newRate);
		onUpdate(category.id, newAmount, newRate);
	}

	// Edit handlers for tax rate
	function handleEditRateClick() {
		setIsEditingRate(true);
		setEditValueRate(taxRateKr.toFixed(2));
	}

	function handleEditRateBlur() {
		const newRate = parseFloat(editValueRate);
		if (!isNaN(newRate) && newRate >= minTaxRate && newRate <= maxTaxRate) {
			setTaxRateKr(newRate);
			onUpdate(category.id, newRate * taxBase, newRate);
		}
		setIsEditingRate(false);
	}

	// Edit handlers for amount
	function handleEditAmountClick() {
		setIsEditingAmount(true);
		setEditValueAmount((calculatedAmount / 1000000).toFixed(1));
	}

	function handleEditAmountBlur() {
		const newAmountMnkr = parseFloat(editValueAmount);
		if (!isNaN(newAmountMnkr)) {
			const newAmount = newAmountMnkr * 1000000;
			const newRate = newAmount / taxBase;
			if (newRate >= minTaxRate && newRate <= maxTaxRate) {
				setTaxRateKr(newRate);
				onUpdate(category.id, newAmount, newRate);
			}
		}
		setIsEditingAmount(false);
	}

	// Reset to default
	function handleResetToDefault() {
		setTaxRateKr(defaultTaxRate);
		onUpdate(category.id, defaultAmount, defaultTaxRate);
	}

	// Calculate percentages for visual sliders
	const defaultTaxRatePercentage = ((defaultTaxRate - minTaxRate) / (maxTaxRate - minTaxRate)) * 100;
	const currentTaxRatePercentage = ((taxRateKr - minTaxRate) / (maxTaxRate - minTaxRate)) * 100;

	const minAmount = minTaxRate * taxBase;
	const maxAmount = maxTaxRate * taxBase;
	const defaultAmount = defaultTaxRate * taxBase;
	const defaultAmountPercentage = ((defaultAmount - minAmount) / (maxAmount - minAmount)) * 100;
	const currentAmountPercentage = ((calculatedAmount - minAmount) / (maxAmount - minAmount)) * 100;

	return (
		<div className="space-y-4">
			{/* Tax Rate Slider (Skattesats) */}
			<div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<h3 className="font-medium text-gray-900">Skattesats</h3>
						<span className="text-xs text-gray-500">(kr per invånare)</span>
					</div>
					<div className="text-right">
						{isEditingRate ? (
							<div className="flex items-center gap-1">
								<input
									type="number"
									step="0.01"
									value={editValueRate}
									onChange={(e) => setEditValueRate(e.target.value)}
									onBlur={handleEditRateBlur}
									onKeyDown={(e) => e.key === "Enter" && handleEditRateBlur()}
									className="w-24 px-2 py-1 text-lg font-bold text-blue-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
									autoFocus
								/>
								<span className="text-sm text-blue-600">kr</span>
							</div>
						) : (
							<div
								className="flex items-center gap-1 cursor-pointer hover:bg-blue-100 px-2 py-1 rounded transition-colors"
								onClick={handleEditRateClick}
								title="Click to edit"
							>
								<span className="text-lg font-bold text-blue-900">{taxRateKr.toFixed(2)}</span>
								<span className="text-sm text-blue-600">kr</span>
							</div>
						)}
					</div>
				</div>

				<div className="relative mb-2">
					<div className="relative h-2 bg-blue-200 rounded-full">
						<div
							className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10"
							style={{ left: `${defaultTaxRatePercentage}%` }}
						/>
						<div
							className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full"
							style={{ width: `${currentTaxRatePercentage}%` }}
						/>
					</div>
					<input
						type="range"
						min={minTaxRate}
						max={maxTaxRate}
						step={0.01}
						value={taxRateKr}
						onChange={handleTaxRateSliderChange}
						disabled={readOnly}
						className="absolute top-0 w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed"
						style={{ zIndex: 20 }}
					/>
				</div>

				<div className="flex justify-between text-xs text-gray-600">
					<span>Min: {minTaxRate.toFixed(2)} kr</span>
					<button
						onClick={handleResetToDefault}
						className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer"
					>
						Default: {defaultTaxRate.toFixed(2)} kr
					</button>
					<span>Max: {maxTaxRate.toFixed(2)} kr</span>
				</div>
			</div>

			{/* Tax Income Slider (Skatteintäkter) - synchronized with tax rate */}
			<div className="p-4 bg-white border border-blue-200 rounded-lg">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<h3 className="font-medium text-gray-900">{category.name}</h3>
						<span className="text-xs text-gray-500">(calculated from tax rate)</span>
					</div>
					<div className="text-right">
						{isEditingAmount ? (
							<div className="flex items-center gap-1">
								<input
									type="number"
									step="0.1"
									value={editValueAmount}
									onChange={(e) => setEditValueAmount(e.target.value)}
									onBlur={handleEditAmountBlur}
									onKeyDown={(e) => e.key === "Enter" && handleEditAmountBlur()}
									className="w-24 px-2 py-1 text-lg font-bold text-blue-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
									autoFocus
								/>
								<span className="text-sm text-blue-600">mnkr</span>
							</div>
						) : (
							<div
								className="flex items-center gap-1 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
								onClick={handleEditAmountClick}
								title="Click to edit"
							>
								<span className="text-lg font-bold text-blue-900">
									{(calculatedAmount / 1000000).toFixed(1)}
								</span>
								<span className="text-sm text-blue-600">mnkr</span>
							</div>
						)}
					</div>
				</div>

				<div className="relative mb-2">
					<div className="relative h-2 bg-blue-100 rounded-full">
						<div
							className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-10"
							style={{ left: `${defaultAmountPercentage}%` }}
						/>
						<div
							className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full"
							style={{ width: `${currentAmountPercentage}%` }}
						/>
					</div>
					<input
						type="range"
						min={minAmount}
						max={maxAmount}
						step={taxBase * 0.01} // Step by 0.01 kr in tax rate
						value={calculatedAmount}
						onChange={handleAmountSliderChange}
						disabled={readOnly}
						className="absolute top-0 w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed"
						style={{ zIndex: 20 }}
					/>
				</div>

				<div className="flex justify-between text-xs text-gray-600">
					<span>Min: {(minAmount / 1000000).toFixed(1)} mnkr</span>
					<button
						onClick={handleResetToDefault}
						className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer"
					>
						Default: {(defaultAmount / 1000000).toFixed(1)} mnkr
					</button>
					<span>Max: {(maxAmount / 1000000).toFixed(1)} mnkr</span>
				</div>

				<div className="text-xs text-blue-600 mt-2 italic">
					Tax base: {(taxBase / 1000000).toFixed(1)} mnkr (population × 1000 kr)
				</div>
			</div>
		</div>
	);
}

/**
 * Income Category Input Component
 * Handles income sources with special treatment for tax rate (skatteintäkter)
 * For tax income: shows TWO synchronized sliders (tax rate in kr + tax income in mnkr)
 */
export default function IncomeCategoryInput({ category, allocation, onUpdate, taxRateInfo, readOnly = false }) {
	const isTaxIncome = category.isTaxRate || category.name.toLowerCase().includes("skatt");

	// Calculate taxBase from existing data if not provided
	// Formula: taxBase = Skatteintäkter / Skattesats (kr)
	const calculatedTaxBase = !taxRateInfo && isTaxIncome && category.amount > 0
		? category.amount / 19 // Assume default 19 kr if no taxRateInfo
		: taxRateInfo?.taxBase;

	// For non-tax income, use regular slider - define all hooks first before any early returns
	const defaultValue = category.defaultAmount || category.amount;
	const minValue = category.minAmount && category.minAmount < defaultValue
		? category.minAmount
		: Math.floor(defaultValue * 0.7);
	const maxValue = minValue + 2 * (defaultValue - minValue);

	const [value, setValue] = useState(allocation?.amount || defaultValue);
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");

	// Sync with allocation prop changes
	const allocationAmount = allocation?.amount;
	useEffect(() => {
		if (allocationAmount !== undefined) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setValue(allocationAmount);
		}
	}, [allocationAmount]);

	// If this is tax income, render TWO synchronized sliders
	if (isTaxIncome && calculatedTaxBase) {
		return (
			<TaxIncomeSliders
				category={category}
				allocation={allocation}
				onUpdate={onUpdate}
				taxBase={calculatedTaxBase}
				taxRateInfo={taxRateInfo}
				readOnly={readOnly}
			/>
		);
	}

	function handleSliderChange(e) {
		const newValue = parseFloat(e.target.value);
		setValue(newValue);
		onUpdate(category.id, newValue);
	}

	function handleEditClick() {
		setIsEditing(true);
		setEditValue((value / 1000000).toFixed(1));
	}

	function handleEditBlur() {
		const newMnkr = parseFloat(editValue);
		if (!isNaN(newMnkr)) {
			const newAmount = newMnkr * 1000000;
			if (newAmount >= minValue && newAmount <= maxValue) {
				setValue(newAmount);
				onUpdate(category.id, newAmount);
			}
		}
		setIsEditing(false);
	}

	function handleResetToDefault() {
		setValue(defaultValue);
		onUpdate(category.id, defaultValue);
	}

	// Calculate percentage for visual indicators
	const defaultPercentage = ((defaultValue - minValue) / (maxValue - minValue)) * 100;
	const currentPercentage = ((value - minValue) / (maxValue - minValue)) * 100;

	return (
		<div className="p-4 bg-white border border-blue-200 rounded-lg">
			<div className="flex items-center justify-between mb-2">
				<h3 className="font-medium text-gray-900">{category.name}</h3>
				<div className="text-right">
					{isEditing ? (
						<div className="flex items-center gap-1">
							<input
								type="number"
								step="0.1"
								value={editValue}
								onChange={(e) => setEditValue(e.target.value)}
								onBlur={handleEditBlur}
								onKeyDown={(e) => e.key === "Enter" && handleEditBlur()}
								className="w-24 px-2 py-1 text-lg font-bold text-blue-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
								autoFocus
							/>
							<span className="text-sm text-blue-600">mnkr</span>
						</div>
					) : (
						<div
							className="flex items-center gap-1 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
							onClick={handleEditClick}
							title="Click to edit"
						>
							<span className="text-lg font-bold text-blue-900">{(value / 1000000).toFixed(1)}</span>
							<span className="text-sm text-blue-600">mnkr</span>
						</div>
					)}
				</div>
			</div>

			<div className="relative mb-2">
				<div className="relative h-2 bg-blue-100 rounded-full">
					<div
						className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-10"
						style={{ left: `${defaultPercentage}%` }}
					/>
					<div
						className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full"
						style={{ width: `${currentPercentage}%` }}
					/>
				</div>
				<input
					type="range"
					min={minValue}
					max={maxValue}
					step={Math.max(1000000, Math.floor((maxValue - minValue) / 100))}
					value={value}
					onChange={handleSliderChange}
					disabled={readOnly}
					className="absolute top-0 w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed"
					style={{ zIndex: 20 }}
				/>
			</div>

			<div className="flex justify-between text-xs text-gray-600">
				<span>Min: {(minValue / 1000000).toFixed(1)} mnkr</span>
				<button
					onClick={handleResetToDefault}
					className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer"
				>
					Default: {(defaultValue / 1000000).toFixed(1)} mnkr
				</button>
				<span>Max: {(maxValue / 1000000).toFixed(1)} mnkr</span>
			</div>
		</div>
	);
}
