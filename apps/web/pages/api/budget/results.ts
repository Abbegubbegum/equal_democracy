import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { BudgetSession, BudgetVote, BudgetResult, User } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { calculateMedianBudget } from "../../../lib/budget/median-calculator";
import { createLogger } from "@/lib/logger";

const log = createLogger("BudgetResults");

export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	// GET - Get results for a session
	if (req.method === "GET") {
		try {
			const { sessionId } = req.query;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID is required" });
			}

			const budgetSession = await BudgetSession.findOne({ sessionId });

			if (!budgetSession) {
				return res.status(404).json({ message: "Budget session not found" });
			}

			// Check if session is closed
			if (budgetSession.status !== "closed") {
				return res.status(400).json({
					message: "Results are only available for closed sessions",
				});
			}

			// Get or calculate results
			let result = await BudgetResult.findOne({ sessionId });

			if (!result) {
				// Calculate results if not already done
				const votes = await BudgetVote.find({ sessionId });

				if (votes.length === 0) {
					return res.status(404).json({ message: "No votes found" });
				}

				const medianData = calculateMedianBudget(votes, budgetSession);

				// Save results
				result = new BudgetResult({
					sessionId,
					...medianData,
				});

				await result.save();
			}

			return res.status(200).json({
				result,
				session: budgetSession,
			});
		} catch (error) {
			log.error("Failed to fetch budget results", { sessionId: req.query.sessionId, error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// POST - Calculate/recalculate results (superadmin only)
	if (req.method === "POST") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		const user = await User.findById(session.user.id);

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// Only superadmins can trigger calculation
		if (!user.isSuperAdmin) {
			return res.status(403).json({ message: "Superadmin access required" });
		}

		try {
			const { sessionId } = req.body;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID is required" });
			}

			const budgetSession = await BudgetSession.findOne({ sessionId });

			if (!budgetSession) {
				return res.status(404).json({ message: "Budget session not found" });
			}

			// Get all votes for this session
			const votes = await BudgetVote.find({ sessionId });

			if (votes.length === 0) {
				return res.status(400).json({
					message: "Cannot calculate results with no votes",
				});
			}

			// Calculate median budget
			const medianData = calculateMedianBudget(votes, budgetSession);

			// Delete existing result if any
			await BudgetResult.deleteOne({ sessionId });

			// Create new result
			const result = new BudgetResult({
				sessionId,
				...medianData,
			});

			await result.save();

			// Close the session if not already closed
			if (budgetSession.status !== "closed") {
				budgetSession.status = "closed";
				await budgetSession.save();
			}

			return res.status(200).json({
				message: "Results calculated successfully",
				result,
			});
		} catch (error) {
			log.error("Failed to calculate budget results", { sessionId: req.body.sessionId, error: error.message });
			return res.status(500).json({
				message: "An error occurred",
				error: error.message,
			});
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
