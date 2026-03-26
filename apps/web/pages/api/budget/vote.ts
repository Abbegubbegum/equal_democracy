import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { BudgetSession, BudgetVote, User } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { validateBudgetVote } from "../../../lib/budget/median-calculator";
import { createLogger } from "@/lib/logger";

const log = createLogger("BudgetVote");

export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	const user = await User.findById(session.user.id);

	if (!user) {
		return res.status(404).json({ message: "User not found" });
	}

	// GET - Get user's vote for a session
	if (req.method === "GET") {
		try {
			const { sessionId } = req.query;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID is required" });
			}

			const vote = await BudgetVote.findOne({
				sessionId,
				userId: user._id,
			});

			if (!vote) {
				return res.status(404).json({ message: "No vote found" });
			}

			return res.status(200).json({ vote });
		} catch (error) {
			log.error("Failed to fetch budget vote", { sessionId: req.query.sessionId, error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// POST - Submit or update vote
	if (req.method === "POST") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const {
				sessionId,
				allocations,
				incomeAllocations,
				totalExpenses,
				totalIncome,
			} = req.body;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID is required" });
			}

			// Get budget session
			const budgetSession = await BudgetSession.findOne({ sessionId });

			if (!budgetSession) {
				return res.status(404).json({ message: "Budget session not found" });
			}

			// Check if session is active
			if (budgetSession.status !== "active") {
				return res.status(400).json({
					message: "Budget session is not active",
				});
			}

			// Validate allocations
			if (!allocations || allocations.length === 0) {
				return res.status(400).json({
					message: "At least one allocation is required",
				});
			}

			// Validate vote against session constraints
			const validation = validateBudgetVote(
				{ allocations, incomeAllocations },
				budgetSession
			);

			if (!validation.valid) {
				return res.status(400).json({
					message: "Invalid budget allocations",
					errors: validation.errors,
				});
			}

			// Find existing vote or create new
			let vote = await BudgetVote.findOne({
				sessionId,
				userId: user._id,
			});

			if (vote) {
				// Update existing vote
				vote.allocations = allocations;
				vote.incomeAllocations = incomeAllocations;
				vote.totalExpenses = totalExpenses;
				vote.totalIncome = totalIncome;
			} else {
				// Create new vote
				vote = new BudgetVote({
					sessionId,
					userId: user._id,
					allocations,
					incomeAllocations,
					totalExpenses,
					totalIncome,
				});
			}

			await vote.save();

			return res.status(200).json({
				message: "Vote submitted successfully",
				vote,
			});
		} catch (error) {
			log.error("Failed to submit budget vote", { sessionId: req.body.sessionId, error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
