import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User, MunicipalSession, Session } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { createLogger } from "../../../lib/logger";

const log = createLogger("CloseItem");

/**
 * POST /api/municipal/close-item
 * Close a specific item in a municipal session
 * For council members with canCloseQuestions permission
 */
export default async function handler(req, res) {
	await connectDB();

	if (req.method !== "POST") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	const user = await User.findById(session.user.id);

	if (!user) {
		return res.status(404).json({ message: "User not found" });
	}

	// Check if user has permission to close questions
	if (!user.canCloseQuestions && !user.isSuperAdmin) {
		return res.status(403).json({
			message: "You do not have permission to close questions. Only council members can close items."
		});
	}

	if (!csrfProtection(req, res)) {
		return;
	}

	try {
		const { municipalSessionId, itemId } = req.body;

		if (!municipalSessionId || !itemId) {
			return res.status(400).json({ message: "Municipal session ID and item ID required" });
		}

		const municipalSession = await MunicipalSession.findById(municipalSessionId);

		if (!municipalSession) {
			return res.status(404).json({ message: "Municipal session not found" });
		}

		// Find the item
		const item = municipalSession.items.id(itemId);

		if (!item) {
			return res.status(404).json({ message: "Item not found" });
		}

		if (item.status === "closed") {
			return res.status(400).json({ message: "Item is already closed" });
		}

		// Close the item
		item.status = "closed";
		item.closedAt = new Date();
		item.closedBy = user._id;

		// Also close the corresponding Session
		if (item.sessionId) {
			await Session.findByIdAndUpdate(item.sessionId, {
				status: "closed",
				phase: "closed",
				endDate: new Date(),
			});
		}

		await municipalSession.save();

		log.info("Item closed", { itemId, title: item.title, closedBy: user.name });

		return res.status(200).json({
			message: "Item closed successfully",
			item: {
				_id: item._id,
				title: item.title,
				status: item.status,
				closedAt: item.closedAt,
			},
		});
	} catch (error) {
		log.error("Failed to close item", { itemId: req.body?.itemId, error: error.message });
		return res.status(500).json({
			message: "Failed to close item",
			error: error.message,
		});
	}
}
