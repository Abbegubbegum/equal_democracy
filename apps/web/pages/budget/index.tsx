import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Wallet } from "lucide-react";

/**
 * Budget Landing Page
 * Shows active budget sessions
 */
export default function BudgetIndexPage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login");
		}
	}, [status, router]);

	const fetchActiveSessions = useCallback(async () => {
		try {
			const response = await fetch("/api/budget/sessions?status=active");
			const data = await response.json();
			const activeSessions = data.sessions || [];
			setSessions(activeSessions);

			// Automatically redirect to first active session
			if (activeSessions.length > 0) {
				router.push(`/budget/${activeSessions[0].sessionId}`);
			}
		} catch (error) {
			console.error("Error fetching sessions:", error);
		} finally {
			setLoading(false);
		}
	}, [router]);

	useEffect(() => {
		if (session) {
			fetchActiveSessions();
		}
	}, [session, fetchActiveSessions]);

	if (status === "loading" || loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-gray-600">Loading...</div>
			</div>
		);
	}

	if (!session) return null;

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-6 shadow-lg">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
								<Wallet className="w-6 h-6 text-white" />
							</div>
							<div>
								<h1 className="text-2xl font-bold">Budget Voting</h1>
								<p className="text-emerald-100 text-sm">
									Demokratisk budgetomröstning
								</p>
							</div>
						</div>
						<button
							onClick={() => router.push("/")}
							className="px-4 py-2 bg-white hover:bg-gray-100 text-emerald-700 font-medium rounded-lg transition-colors"
						>
							Back to Home
						</button>
					</div>
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6">
				<div className="mb-6">
					<h2 className="text-xl font-semibold text-gray-800 mb-2">
						Active Budget Sessions
					</h2>
					<p className="text-gray-600">
						Select a budget session to view and vote on budget allocations
					</p>
				</div>

				{sessions.length === 0 ? (
					<div className="bg-white rounded-xl shadow-sm p-12 text-center">
						<Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
						<h3 className="text-lg font-medium text-gray-700 mb-2">
							No Active Budget Sessions
						</h3>
						<p className="text-gray-500">
							There are no active budget sessions at the moment. Check back
							later!
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{sessions.map((budgetSession) => (
							<div
								key={budgetSession._id}
								className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer border border-gray-200 hover:border-emerald-300"
								onClick={() =>
									router.push(`/budget/${budgetSession.sessionId}`)
								}
							>
								<h3 className="text-lg font-semibold text-gray-900 mb-2">
									{budgetSession.name}
								</h3>
								<p className="text-sm text-gray-600 mb-4">
									{budgetSession.municipality}
								</p>
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-gray-500">Total Budget:</span>
										<span className="font-medium text-gray-900">
											{(budgetSession.totalBudget / 1000000).toFixed(1)}{" "}
											mnkr
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-gray-500">Categories:</span>
										<span className="font-medium text-gray-900">
											{budgetSession.categories?.length || 0}
										</span>
									</div>
								</div>
								<button className="mt-4 w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors">
									View Budget
								</button>
							</div>
						))}
					</div>
				)}

				{session.user?.isSuperAdmin && (
					<div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
						<p className="text-sm text-blue-800">
							<strong>Admin:</strong> Manage budget sessions from the{" "}
							<button
								onClick={() => router.push("/budget/admin")}
								className="underline hover:text-blue-900"
							>
								Budget Admin Panel
							</button>
						</p>
					</div>
				)}
			</main>
		</div>
	);
}
