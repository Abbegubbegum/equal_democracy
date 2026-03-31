import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../lib/mongodb";
import { MunicipalSession } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";

const log = createLogger("BoardSessions");

/**
 * GET /api/municipal/board-sessions
 * Get sessions for a specific municipality and board
 * Public endpoint
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	await connectDB();

	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	try {
		const { municipality: municipalityParam, board: boardParam, status } = req.query;
		const municipality = String(municipalityParam || "");
		const board = String(boardParam || "");

		if (!municipalityParam || !boardParam) {
			return res.status(400).json({
				message: "Municipality and board are required",
			});
		}

		// Normalize board name (URL format to DB format)
		// e.g. "kommunfullmaktige" -> "Kommunfullmäktige"
		const boardMap: Record<string, string> = {
			kommunfullmaktige: "Kommunfullmäktige",
			kommunstyrelsen: "Kommunstyrelsen",
			"barn-och-ungdomsnamnden": "Barn- och ungdomsnämnden",
			socialnamnden: "Socialnämnden",
			"bygg-och-miljotillsynsnamnden": "Bygg- och miljötillsynsnämnden",
		};

		const meetingType =
			boardMap[board.toLowerCase()] || board.charAt(0).toUpperCase() + board.slice(1);

		const query: Record<string, unknown> = {
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
			query.status = String(status);
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
