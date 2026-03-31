import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import connectDB from "../../../../lib/mongodb";
import { BudgetArgument } from "../../../../lib/models";
import { csrfProtection } from "../../../../lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("BudgetDebateHelpful");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

	await connectDB();

	const session = await getServerSession(req, res, authOptions);
	if (!session) return res.status(401).json({ message: "You must be logged in" });

	if (!csrfProtection(req, res)) return;

	const { argumentId } = req.body;
	if (!argumentId) return res.status(400).json({ message: "argumentId required" });

	try {
		const userId = session.user.id;
		const arg = await BudgetArgument.findById(argumentId);
		if (!arg) return res.status(404).json({ message: "Argument not found" });

		// Cannot mark your own argument as helpful
		if (arg.userId.toString() === userId) {
			return res.status(400).json({ message: "Cannot mark your own argument as helpful" });
		}

		const alreadyVoted = arg.helpfulVotes.some((id) => id.toString() === userId);
		if (alreadyVoted) {
			arg.helpfulVotes = arg.helpfulVotes.filter((id) => id.toString() !== userId);
		} else {
			arg.helpfulVotes.push(userId);
		}

		await arg.save();

		return res.status(200).json({
			helpfulCount: arg.helpfulVotes.length,
			userFoundHelpful: !alreadyVoted,
		});
	} catch (error) {
		log.error("Failed to toggle helpful vote", { error: error.message });
		return res.status(500).json({ message: "An error occurred" });
	}
}
