import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { BudgetSession, User } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { generateSessionId, ensureUniqueSessionId } from "../../../lib/budget/session-id";
import { createLogger } from "@/lib/logger";

const log = createLogger("BudgetSessions");

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

	// GET - List all budget sessions (with filtering)
	if (req.method === "GET") {
		try {
			const { status, createdBy } = req.query;

			const query = {};
			if (status) {
				query.status = status;
			}
			if (createdBy) {
				query.createdBy = createdBy;
			}

			// Don't populate creator info for regular users (anonymity)
			// Superadmins can still see creator in admin endpoints if needed
			const sessions = await BudgetSession.find(query)
				.sort({ createdAt: -1 });

			return res.status(200).json({ sessions });
		} catch (error) {
			log.error("Failed to fetch budget sessions", { error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// POST - Create new budget session (superadmin only)
	if (req.method === "POST") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		// Only superadmins can create budget sessions
		if (!user.isSuperAdmin) {
			return res.status(403).json({ message: "Superadmin access required" });
		}

		try {
			const {
				name,
				municipality,
				totalBudget,
				categories,
				incomeCategories,
				startDate,
				endDate,
			} = req.body;

			// Validate required fields
			if (!name || !municipality || !totalBudget) {
				return res.status(400).json({
					message: "Name, municipality, and totalBudget are required",
				});
			}

			if (!categories || categories.length === 0) {
				return res.status(400).json({
					message: "At least one category is required",
				});
			}

			// Generate user-friendly session ID
			const baseSessionId = generateSessionId(name, municipality);
			const sessionId = await ensureUniqueSessionId(baseSessionId, BudgetSession);

			// Create new budget session
			const budgetSession = new BudgetSession({
				sessionId,
				name,
				municipality,
				totalBudget,
				categories,
				incomeCategories,
				startDate: startDate ? new Date(startDate) : null,
				endDate: endDate ? new Date(endDate) : null,
				createdBy: user._id,
				status: "draft",
			});

			await budgetSession.save();

			return res.status(201).json({
				message: "Budget session created successfully",
				session: budgetSession,
			});
		} catch (error) {
			log.error("Failed to create budget session", { error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// PUT - Update budget session (superadmin only)
	if (req.method === "PUT") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		// Only superadmins can update budget sessions
		if (!user.isSuperAdmin) {
			return res.status(403).json({ message: "Superadmin access required" });
		}

		try {
			const { sessionId, ...updateData } = req.body;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID is required" });
			}

			const budgetSession = await BudgetSession.findOne({ sessionId });

			if (!budgetSession) {
				return res.status(404).json({ message: "Budget session not found" });
			}

			// Update allowed fields
			const allowedFields = [
				"name",
				"municipality",
				"totalBudget",
				"categories",
				"incomeCategories",
				"startDate",
				"endDate",
				"status",
			];

			for (const field of allowedFields) {
				if (updateData[field] !== undefined) {
					budgetSession[field] = updateData[field];
				}
			}

			await budgetSession.save();

			return res.status(200).json({
				message: "Budget session updated successfully",
				session: budgetSession,
			});
		} catch (error) {
			log.error("Failed to update budget session", { sessionId: req.body.sessionId, error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// DELETE - Delete budget session (superadmin only)
	if (req.method === "DELETE") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		// Only superadmins can delete budget sessions
		if (!user.isSuperAdmin) {
			return res.status(403).json({ message: "Superadmin access required" });
		}

		try {
			const { sessionId } = req.query;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID is required" });
			}

			const budgetSession = await BudgetSession.findOne({ sessionId });

			if (!budgetSession) {
				return res.status(404).json({ message: "Budget session not found" });
			}

			// Don't allow deletion of active sessions
			if (budgetSession.status === "active") {
				return res.status(400).json({
					message: "Cannot delete active session. Close it first.",
				});
			}

			await BudgetSession.findByIdAndDelete(budgetSession._id);

			return res.status(200).json({
				message: "Budget session deleted successfully",
			});
		} catch (error) {
			log.error("Failed to delete budget session", { sessionId: req.query.sessionId, error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
