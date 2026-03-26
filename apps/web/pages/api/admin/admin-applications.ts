import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { isSuperAdmin } from "../../../lib/admin-helper";
import {
	sendAdminApprovalNotification,
	sendAdminDenialNotification,
} from "../../../lib/email";
import { createLogger } from "../../../lib/logger";

const log = createLogger("AdminApplications");

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

	// GET - List all pending applications
	if (req.method === "GET") {
		try {
			const pendingApplications = await User.find({
				adminStatus: "pending",
			})
				.select("name email appliedForAdminAt organization requestedSessions createdAt")
				.sort({ appliedForAdminAt: -1 });

			return res.status(200).json({ applications: pendingApplications });
		} catch (error) {
			log.error("Failed to fetch admin applications", { error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	// POST - Approve or deny an application
	if (req.method === "POST") {
		// CSRF protection
		if (!csrfProtection(req, res)) {
			return;
		}

		const { userId, action, sessionLimit } = req.body;

		if (!userId || !action) {
			return res
				.status(400)
				.json({ message: "User ID and action are required" });
		}

		if (!["approve", "deny"].includes(action)) {
			return res
				.status(400)
				.json({ message: "Action must be 'approve' or 'deny'" });
		}

		if (action === "approve" && sessionLimit) {
			if (sessionLimit < 1 || sessionLimit > 50) {
				return res.status(400).json({
					message: "Session limit must be between 1 and 50",
				});
			}
		}

		try {
			const user = await User.findById(userId);

			if (!user) {
				return res.status(404).json({ message: "User not found" });
			}

			if (user.adminStatus !== "pending") {
				return res.status(400).json({
					message: "User does not have a pending application",
				});
			}

			if (action === "approve") {
				user.isAdmin = true;
				user.adminStatus = "approved";
				const limit = sessionLimit || 10;
				user.sessionLimit = limit;
				user.remainingSessions = limit;
			} else {
				user.adminStatus = "denied";
			}

			await user.save();

			// Send email notification to the applicant
			try {
				if (action === "approve") {
					await sendAdminApprovalNotification(
						user.email,
						user.name,
						user.sessionLimit
					);
				} else {
					await sendAdminDenialNotification(
						user.email,
						user.name
					);
				}
			} catch (emailError) {
				// Log error but don't fail the request
				log.error("Failed to send notification email", { email: user.email, error: emailError.message });
			}

			return res.status(200).json({
				message: `Admin application ${action}ed successfully`,
				user: {
					_id: user._id,
					name: user.name,
					email: user.email,
					adminStatus: user.adminStatus,
					sessionLimit: user.sessionLimit,
					remainingSessions: user.remainingSessions,
				},
			});
		} catch (error) {
			log.error("Failed to process admin application", { userId: req.body?.userId, error: error.message });
			return res.status(500).json({ message: "An error occurred" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
