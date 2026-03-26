import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { SessionRequest } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { isSuperAdmin } from "../../../lib/admin-helper";
import {
	sendSessionRequestApprovalNotification,
	sendSessionRequestDenialNotification,
} from "../../../lib/email";
import { createLogger } from "../../../lib/logger";

const log = createLogger("SessionRequests");

export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	// Only superadmins can access this endpoint
	if (!isSuperAdmin(session.user)) {
		return res.status(403).json({ message: "Superadmin access required" });
	}

	// GET - List all pending session requests
	if (req.method === "GET") {
		try {
			const pendingRequests = await SessionRequest.find({
				status: "pending",
			})
				.populate("userId", "name email organization remainingSessions")
				.sort({ createdAt: -1 });

			return res.status(200).json({ requests: pendingRequests });
		} catch (error) {
			log.error("Failed to fetch session requests", { error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// POST - Approve or deny a session request
	if (req.method === "POST") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		const { requestId, action, grantedSessions } = req.body;

		if (!requestId || !action) {
			return res
				.status(400)
				.json({ message: "Request ID and action are required" });
		}

		if (!["approve", "deny"].includes(action)) {
			return res
				.status(400)
				.json({ message: "Action must be 'approve' or 'deny'" });
		}

		if (action === "approve" && grantedSessions) {
			if (grantedSessions < 1 || grantedSessions > 50) {
				return res.status(400).json({
					message: "Granted sessions must be between 1 and 50",
				});
			}
		}

		try {
			const request = await SessionRequest.findById(requestId).populate(
				"userId"
			);

			if (!request) {
				return res
					.status(404)
					.json({ message: "Session request not found" });
			}

			if (request.status !== "pending") {
				return res.status(400).json({
					message: "This request has already been processed",
				});
			}

			const user = request.userId;

			if (action === "approve") {
				const sessionsToGrant =
					grantedSessions || request.requestedSessions;

				// Add to remaining sessions
				user.remainingSessions =
					(user.remainingSessions || 0) + sessionsToGrant;

				// Update session limit if needed
				if (user.remainingSessions > user.sessionLimit) {
					user.sessionLimit = user.remainingSessions;
				}

				await user.save();

				request.status = "approved";
				request.processedAt = new Date();
				request.processedBy = session.user.id;
				await request.save();

				// Send approval email notification
				try {
					await sendSessionRequestApprovalNotification(
						user.email,
						user.name,
						sessionsToGrant
					);
				} catch (emailError) {
					log.error("Failed to send approval email", { email: user.email, error: emailError.message });
				}

				return res.status(200).json({
					message: `Granted ${sessionsToGrant} sessions to ${user.name}`,
					request,
				});
			} else {
				request.status = "denied";
				request.processedAt = new Date();
				request.processedBy = session.user.id;
				await request.save();

				// Send denial email notification
				try {
					await sendSessionRequestDenialNotification(
						user.email,
						user.name
					);
				} catch (emailError) {
					log.error("Failed to send denial email", { email: user.email, error: emailError.message });
				}

				return res.status(200).json({
					message: `Request denied for ${user.name}`,
					request,
				});
			}
		} catch (error) {
			log.error("Failed to process session request", { requestId: req.body?.requestId, error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
