import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User, SessionRequest } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { sendSessionRequestNotification } from "../../../lib/email";
import { createLogger } from "../../../lib/logger";

const log = createLogger("SessionRequest");

export default async function handler(req, res) {
	await connectDB();

	if (req.method !== "POST") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	// CSRF protection
	if (!csrfProtection(req, res)) {
		return;
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	try {
		const { requestedSessions } = req.body;

		// Validate input
		if (!requestedSessions) {
			return res
				.status(400)
				.json({ message: "Requested sessions is required" });
		}

		const sessions = parseInt(requestedSessions);
		if (isNaN(sessions) || sessions < 1 || sessions > 50) {
			return res.status(400).json({
				message: "Requested sessions must be between 1 and 50",
			});
		}

		const user = await User.findById(session.user.id);

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// Only admins (not superadmins) should request more sessions
		if (!user.isAdmin || user.isSuperAdmin) {
			return res.status(400).json({
				message: "Only light admins can request more sessions",
			});
		}

		// Check if there's already a pending request for this user
		const existingRequest = await SessionRequest.findOne({
			userId: user._id,
			status: "pending",
		});

		if (existingRequest) {
			return res.status(400).json({
				message: "You already have a pending request for more sessions",
			});
		}

		// Create a new session request
		await SessionRequest.create({
			userId: user._id,
			requestedSessions: sessions,
			status: "pending",
		});

		// Send email notifications to all superadmins
		try {
			const superadmins = await User.find({ isSuperAdmin: true });

			// Send email to each superadmin
			for (const superadmin of superadmins) {
				if (superadmin.email) {
					await sendSessionRequestNotification(
						superadmin.email,
						user.name,
						user.email,
						user.organization || "N/A",
						user.remainingSessions || 0,
						sessions
					);
				}
			}
		} catch (emailError) {
			// Log error but don't fail the request
			log.error("Failed to send request emails", { error: emailError.message });
		}

		return res.status(200).json({
			message:
				"Your request for more sessions has been submitted. A superadmin will review it shortly.",
		});
	} catch (error) {
		log.error("Failed to request more sessions", { userId: session?.user?.id, error: error.message });
		return res.status(500).json({ message: "An error occurred" });
	}
}
