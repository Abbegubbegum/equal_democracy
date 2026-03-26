import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { BudgetArgument } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("BudgetDebate");

export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);
	if (!session) return res.status(401).json({ message: "You must be logged in" });

	// GET — fetch all visible arguments for a session
	if (req.method === "GET") {
		const { sessionId } = req.query;
		if (!sessionId) return res.status(400).json({ message: "sessionId required" });

		try {
			const args = await BudgetArgument.find({ sessionId, isHidden: false })
				.sort({ helpfulVotes: -1, createdAt: -1 })
				.lean();

			// Annotate each argument with whether the current user has voted it helpful
			const userId = session.user.id;
			const annotated = args.map((a) => ({
				...a,
				helpfulCount: a.helpfulVotes.length,
				userFoundHelpful: a.helpfulVotes.some((id) => id.toString() === userId),
				isOwn: a.userId.toString() === userId,
			}));

			return res.status(200).json({ arguments: annotated });
		} catch (error) {
			log.error("Failed to fetch arguments", { error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// POST — create or update an argument (one per user/category/direction)
	if (req.method === "POST") {
		if (!csrfProtection(req, res)) return;

		const { sessionId, categoryId, categoryName, direction, text } = req.body;

		if (!sessionId || !categoryId || !categoryName || !direction || !text) {
			return res.status(400).json({ message: "All fields are required" });
		}
		if (!["up", "down"].includes(direction)) {
			return res.status(400).json({ message: "Invalid direction" });
		}
		if (text.trim().length === 0) {
			return res.status(400).json({ message: "Argument text cannot be empty" });
		}
		if (text.length > 400) {
			return res.status(400).json({ message: "Argument too long (max 400 characters)" });
		}

		try {
			const arg = await BudgetArgument.findOneAndUpdate(
				{ sessionId, userId: session.user.id, categoryId, direction },
				{
					$set: {
						userName: session.user.name,
						categoryName,
						text: text.trim(),
					},
					$setOnInsert: {
						sessionId,
						userId: session.user.id,
						categoryId,
						direction,
						helpfulVotes: [],
						isHidden: false,
					},
				},
				{ upsert: true, new: true }
			);

			return res.status(200).json({
				argument: {
					...arg.toObject(),
					helpfulCount: arg.helpfulVotes.length,
					userFoundHelpful: false,
					isOwn: true,
				},
			});
		} catch (error) {
			log.error("Failed to save argument", { error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// DELETE — admin hide an argument
	if (req.method === "DELETE") {
		if (!session.user.isAdmin && !session.user.isSuperAdmin) {
			return res.status(403).json({ message: "Admins only" });
		}
		if (!csrfProtection(req, res)) return;

		const { argumentId } = req.body;
		if (!argumentId) return res.status(400).json({ message: "argumentId required" });

		try {
			await BudgetArgument.findByIdAndUpdate(argumentId, { isHidden: true });
			return res.status(200).json({ message: "Hidden" });
		} catch (error) {
			log.error("Failed to hide argument", { error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
