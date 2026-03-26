import connectDB from "../../../lib/mongodb";
import { MunicipalSession } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";

const log = createLogger("BoardSessions");

/**
 * GET /api/municipal/board-sessions
 * Get sessions for a specific municipality and board
 * Public endpoint
 */
export default async function handler(req, res) {
	await connectDB();

	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	try {
		const { municipality, board, status } = req.query;

		if (!municipality || !board) {
			return res.status(400).json({
				message: "Municipality and board are required",
			});
		}

		// Normalize board name (URL format to DB format)
		// e.g. "kommunfullmaktige" -> "Kommunfullmäktige"
		const boardMap = {
			kommunfullmaktige: "Kommunfullmäktige",
			kommunstyrelsen: "Kommunstyrelsen",
			"barn-och-ungdomsnamnden": "Barn- och ungdomsnämnden",
			socialnamnden: "Socialnämnden",
			"bygg-och-miljotillsynsnamnden": "Bygg- och miljötillsynsnämnden",
		};

		const meetingType =
			boardMap[board.toLowerCase()] || board.charAt(0).toUpperCase() + board.slice(1);

		const query = {
			municipality: municipality.charAt(0).toUpperCase() + municipality.slice(1),
			meetingType: meetingType,
		};

		// Filter by status if provided
		if (status === "closed") {
			// For "closed" status, find sessions with ANY closed items
			query["items.status"] = "closed";
		} else if (status === "active") {
			// For "active", show sessions with active items
			query.status = "active";
			query["items.status"] = "active";
		} else if (status) {
			query.status = status;
		} else {
			// Default to active sessions
			query.status = "active";
		}

		const sessions = await MunicipalSession.find(query)
			.sort({ meetingDate: -1 })
			.limit(50)
			.lean();

		return res.status(200).json({ sessions });
	} catch (error) {
		log.error("Failed to fetch sessions", { error: error.message });
		return res.status(500).json({
			message: "Failed to fetch sessions",
			error: error.message,
		});
	}
}
