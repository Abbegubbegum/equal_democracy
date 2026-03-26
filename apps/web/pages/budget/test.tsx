import { useState } from "react";
import SimpleTreemap from "../../components/budget/SimpleTreemap";

/**
 * Test page for Simple Treemap
 * Shows sample budget data for 9 committees
 */
export default function TreemapTestPage() {
	// Sample data with 9 committees in different amounts
	const [categories] = useState([
		{
			id: "kommunstyrelsen",
			name: "Kommunstyrelsen",
			amount: 148800000, // 148.8 mnkr
			color: "hsl(120, 70%, 50%)", // Green
		},
		{
			id: "barn-ungdom",
			name: "Barn- och ungdomsnämnden",
			amount: 234500000, // 234.5 mnkr
			color: "hsl(105, 70%, 50%)",
		},
		{
			id: "skolpeng",
			name: "Skolpeng",
			amount: 678500000, // 678.5 mnkr (largest)
			color: "hsl(90, 70%, 50%)",
		},
		{
			id: "utbildning",
			name: "Utbildningsnämnden",
			amount: 123400000, // 123.4 mnkr
			color: "hsl(75, 70%, 50%)",
		},
		{
			id: "gymnasieskolpeng",
			name: "Gymnasieskolpeng",
			amount: 345600000, // 345.6 mnkr
			color: "hsl(60, 70%, 50%)", // Yellow
		},
		{
			id: "social",
			name: "Socialnämnden",
			amount: 289300000, // 289.3 mnkr
			color: "hsl(45, 70%, 50%)",
		},
		{
			id: "fritid",
			name: "Fritidsnämnden",
			amount: 45200000, // 45.2 mnkr
			color: "hsl(30, 70%, 50%)",
		},
		{
			id: "kultur",
			name: "Kulturnämnden",
			amount: 34800000, // 34.8 mnkr
			color: "hsl(15, 70%, 50%)",
		},
		{
			id: "bygg-miljo",
			name: "Bygg- och miljötillsynsnämnden",
			amount: 25500000, // 25.5 mnkr (smallest)
			color: "hsl(0, 70%, 50%)", // Red
		},
	]);

	const totalBudget = categories.reduce((sum, cat) => sum + cat.amount, 0);

	return (
		<div className="min-h-screen bg-gray-50 p-4">
			<div className="max-w-4xl mx-auto space-y-6">
				<div className="bg-white rounded-lg shadow-sm p-6">
					<h1 className="text-2xl font-bold text-gray-800 mb-2">
						Budget Treemap Test
					</h1>
					<p className="text-gray-600 mb-4">
						Visar 9 nämnders budgeterade nettokostnader 2025
					</p>
					<div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
						<p className="text-sm text-emerald-800">
							<strong>Total budget:</strong>{" "}
							{(totalBudget / 1000000).toFixed(1)} mnkr
						</p>
						<p className="text-xs text-emerald-700 mt-1">
							Färgskala: Grönt (Kommunstyrelsen) → Rött (Bygg- och
							miljötillsynsnämnden)
						</p>
					</div>
				</div>

				<div className="bg-white rounded-lg shadow-sm p-6">
					<h2 className="text-lg font-semibold text-gray-800 mb-4">
						Treemap Visualisering
					</h2>
					<SimpleTreemap categories={categories} />
				</div>

				<div className="bg-white rounded-lg shadow-sm p-6">
					<h2 className="text-lg font-semibold text-gray-800 mb-4">
						Nämndernas budget
					</h2>
					<div className="space-y-2">
						{categories
							.sort((a, b) => b.amount - a.amount)
							.map((cat, index) => (
								<div
									key={cat.id}
									className="flex items-center justify-between p-3 rounded-lg border border-gray-200"
								>
									<div className="flex items-center gap-3">
										<div
											className="w-4 h-4 rounded"
											style={{ backgroundColor: cat.color }}
										/>
										<span className="font-medium text-gray-700">
											{index + 1}. {cat.name}
										</span>
									</div>
									<span className="font-semibold text-gray-900">
										{(cat.amount / 1000000).toFixed(1)} mnkr
									</span>
								</div>
							))}
					</div>
				</div>

				<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
					<h3 className="font-semibold text-blue-900 mb-2">
						Nästa steg
					</h3>
					<ul className="text-sm text-blue-800 space-y-1">
						<li>✓ Mobilanpassad treemap</li>
						<li>✓ Grön-till-röd färgskala</li>
						<li>✓ Visar nämndnamn och belopp i mnkr</li>
						<li>• Läs in data från PDF med AI</li>
						<li>• Lägg till interaktivitet (klick för zoom)</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
