import dbConnect from "@/lib/mongodb";
import { Session } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess, isSuperAdmin } from "@/lib/admin-helper";
import { closeSession } from "@/lib/session-close";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminCloseSession");

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// Check if user has admin access
	const session = await getServerSession(req, res, authOptions);
	if (!session || !hasAdminAccess(session.user)) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { sessionId } = req.body;

		if (!sessionId) {
			return res.status(400).json({ error: "Session ID is required" });
		}

		// Get the session
		const sessionToClose = await Session.findById(sessionId);
		if (!sessionToClose) {
			return res.status(404).json({ error: "Session not found" });
		}

		if (sessionToClose.status === "closed") {
			return res.status(400).json({ error: "Session is already closed" });
		}

		// Check if user is authorized to close this session
		// Only the creator or a superadmin can close a session
		if (
			!isSuperAdmin(session.user) &&
			sessionToClose.createdBy?.toString() !== session.user.id
		) {
			return res.status(403).json({
				error: "You can only close sessions that you created",
			});
		}

		const result = await closeSession(sessionToClose);

		return res.status(200).json({
			message: "Session closed successfully",
			session: sessionToClose,
			topProposals: result.topProposals || [],
		});
	} catch (error) {
		log.error("Failed to close session", { sessionId: req.body?.sessionId, error: error.message });
		return res.status(500).json({ error: "Failed to close session" });
	}
}
