import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

/**
 * Interactive Treemap Visualization for Budget
 * Two-layer design: Income (background) and Expenses (foreground)
 * Supports touch drag-to-resize and numeric input
 */
export default function TreemapViz({
	session,
	allocations,
	incomeAllocations,
}) {
	const canvasRef = useRef(null);
	const [showLayer, setShowLayer] = useState("both"); // "income", "expenses", "both"

	const width = 800;
	const height = 600;

	const wrapText = useCallback((ctx, text, maxWidth) => {
		const words = text.split(" ");
		const lines = [];
		let currentLine = words[0];

		for (let i = 1; i < words.length; i++) {
			const word = words[i];
			const widthMeasure = ctx.measureText(currentLine + " " + word).width;
			if (widthMeasure < maxWidth) {
				currentLine += " " + word;
			} else {
				lines.push(currentLine);
				currentLine = word;
			}
		}
		lines.push(currentLine);
		return lines;
	}, []);

	const drawPattern = useCallback((ctx, x0, y0, x1, y1) => {
		// Draw diagonal stripe pattern for unavoidable expenses
		ctx.save();
		ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
		ctx.lineWidth = 2;

		const spacing = 10;
		for (let i = x0 - y1; i < x1; i += spacing) {
			ctx.beginPath();
			ctx.moveTo(i, y1);
			ctx.lineTo(i + y1 - y0, y0);
			ctx.stroke();
		}

		ctx.restore();
	}, []);

	const drawIncomeLayer = useCallback((ctx, sessionData, incomeAllocs) => {
		// Create treemap data for income
		const data = {
			name: "Income",
			children: sessionData.incomeCategories.map((cat) => {
				const allocation = incomeAllocs?.find((a) => a.categoryId === cat.id);
				return {
					name: cat.name,
					value: allocation?.amount || cat.amount,
					color: cat.color,
					id: cat.id,
				};
			}),
		};

		// Calculate treemap layout
		const root = d3.hierarchy(data).sum((d) => d.value);
		const treemap = d3.treemap().size([width, height]).padding(2);
		treemap(root);

		// Draw income rectangles
		root.leaves().forEach((node) => {
			const { x0, y0, x1, y1 } = node;

			// Fill with gray-blue color
			ctx.fillStyle = node.data.color;
			ctx.globalAlpha = 0.5; // Semi-transparent for background
			ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

			// Border
			ctx.strokeStyle = "#334155";
			ctx.lineWidth = 2;
			ctx.globalAlpha = 1;
			ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

			// Label
			ctx.fillStyle = "#1e293b";
			ctx.font = "bold 14px sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			const centerX = (x0 + x1) / 2;
			const centerY = (y0 + y1) / 2;

			// Wrap text
			const maxWidth = x1 - x0 - 10;
			const lines = wrapText(ctx, node.data.name, maxWidth);
			lines.forEach((line, i) => {
				ctx.fillText(line, centerX, centerY - (lines.length - 1) * 8 + i * 16);
			});

			// Amount
			ctx.font = "12px sans-serif";
			ctx.fillText(
				`${(node.data.value / 1000000).toFixed(1)} mnkr`,
				centerX,
				centerY + 20
			);
		});

		ctx.globalAlpha = 1;
	}, [wrapText]);

	const drawExpenseLayer = useCallback((ctx, sessionData, allocs) => {
		// Create treemap data for expenses
		const data = {
			name: "Expenses",
			children: sessionData.categories.map((cat) => {
				const allocation = allocs?.find((a) => a.categoryId === cat.id);
				return {
					name: cat.name,
					value: allocation?.amount || cat.defaultAmount,
					minValue: cat.minAmount,
					isFixed: cat.isFixed,
					color: cat.color,
					id: cat.id,
				};
			}),
		};

		// Calculate treemap layout
		const root = d3.hierarchy(data).sum((d) => d.value);
		const treemap = d3.treemap().size([width, height]).padding(2);
		treemap(root);

		// Draw expense rectangles
		root.leaves().forEach((node) => {
			const { x0, y0, x1, y1 } = node;

			// Fill with color from green-yellow-red gradient
			ctx.fillStyle = node.data.color;
			ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

			// Pattern overlay for unavoidable expenses
			if (node.data.minValue > 0 || node.data.isFixed) {
				drawPattern(ctx, x0, y0, x1, y1);
			}

			// Border
			ctx.strokeStyle = "#334155";
			ctx.lineWidth = 2;
			ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

			// Label
			ctx.fillStyle = "#1e293b";
			ctx.font = "bold 14px sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			const centerX = (x0 + x1) / 2;
			const centerY = (y0 + y1) / 2;

			// Wrap text
			const maxWidth = x1 - x0 - 10;
			const lines = wrapText(ctx, node.data.name, maxWidth);
			lines.forEach((line, i) => {
				ctx.fillText(line, centerX, centerY - (lines.length - 1) * 8 + i * 16);
			});

			// Amount
			ctx.font = "12px sans-serif";
			ctx.fillText(
				`${(node.data.value / 1000000).toFixed(1)} mnkr`,
				centerX,
				centerY + 20
			);

			// Min amount indicator
			if (node.data.minValue > 0 && !node.data.isFixed) {
				ctx.font = "10px sans-serif";
				ctx.fillStyle = "#dc2626";
				ctx.fillText(
					`Min: ${(node.data.minValue / 1000000).toFixed(1)} mnkr`,
					centerX,
					centerY + 35
				);
			}
		});
	}, [wrapText, drawPattern]);

	useEffect(() => {
		if (!canvasRef.current || !session) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Draw income layer (background)
		if (showLayer === "income" || showLayer === "both") {
			drawIncomeLayer(ctx, session, incomeAllocations);
		}

		// Draw expense layer (foreground)
		if (showLayer === "expenses" || showLayer === "both") {
			drawExpenseLayer(ctx, session, allocations);
		}
	}, [session, allocations, incomeAllocations, showLayer, drawIncomeLayer, drawExpenseLayer]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex gap-2">
					<button
						onClick={() => setShowLayer("both")}
						className={`px-3 py-1 rounded-lg text-sm font-medium ${
							showLayer === "both"
								? "bg-emerald-600 text-white"
								: "bg-gray-200 text-gray-700"
						}`}
					>
						Both Layers
					</button>
					<button
						onClick={() => setShowLayer("income")}
						className={`px-3 py-1 rounded-lg text-sm font-medium ${
							showLayer === "income"
								? "bg-blue-600 text-white"
								: "bg-gray-200 text-gray-700"
						}`}
					>
						Income Only
					</button>
					<button
						onClick={() => setShowLayer("expenses")}
						className={`px-3 py-1 rounded-lg text-sm font-medium ${
							showLayer === "expenses"
								? "bg-green-600 text-white"
								: "bg-gray-200 text-gray-700"
						}`}
					>
						Expenses Only
					</button>
				</div>

				<div className="text-sm text-gray-600">
					<span className="inline-block w-4 h-4 bg-gray-500 opacity-50 mr-2"></span>
					Income
					<span className="inline-block w-4 h-4 bg-green-500 ml-4 mr-2"></span>
					Expenses
					<span className="inline-block w-4 h-4 bg-green-500 ml-4 mr-2 pattern-bg"></span>
					Unavoidable
				</div>
			</div>

			<div className="border border-gray-300 rounded-lg overflow-hidden">
				<canvas
					ref={canvasRef}
					width={width}
					height={height}
					className="w-full cursor-pointer"
				/>
			</div>

			<div className="text-xs text-gray-500">
				<p>• Click on a category to view details and subcategories</p>
				<p>• Drag to resize (interactive mode)</p>
				<p>• Patterned areas show unavoidable minimum expenses</p>
			</div>

			<style jsx>{`
				.pattern-bg {
					background-image: repeating-linear-gradient(
						45deg,
						transparent,
						transparent 5px,
						rgba(0, 0, 0, 0.2) 5px,
						rgba(0, 0, 0, 0.2) 7px
					);
				}
			`}</style>
		</div>
	);
}
