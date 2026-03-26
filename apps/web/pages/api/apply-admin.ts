import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { User } from "../../lib/models";
import { csrfProtection } from "../../lib/csrf";
import { sendAdminApplicationNotification } from "../../lib/email";
import { createLogger } from "@/lib/logger";

const log = createLogger("ApplyAdmin");

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
		const { name, organization, requestedSessions } = req.body;

		// Validate input
		if (!name || !organization || !requestedSessions) {
			return res.status(400).json({ message: "All fields are required" });
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

		// Check if already an admin or superadmin
		if (user.isAdmin || user.isSuperAdmin) {
			return res
				.status(400)
				.json({ message: "You already have admin privileges" });
		}

		// Check if already applied
		if (user.adminStatus === "pending") {
			return res.status(400).json({
				message: "You already have a pending admin application",
			});
		}

		// Check if previously denied
		if (user.adminStatus === "denied") {
			// Allow reapplication after 30 days
			if (
				user.appliedForAdminAt &&
				Date.now() - user.appliedForAdminAt < 30 * 24 * 60 * 60 * 1000
			) {
				return res.status(400).json({
					message:
						"Your previous application was denied. Please wait 30 days before reapplying.",
				});
			}
		}

		// Update user with application data
		user.name = name; // Update name in case they changed it
		user.adminStatus = "pending";
		user.appliedForAdminAt = new Date();
		user.organization = organization;
		user.requestedSessions = sessions;
		await user.save();

		// Send email notifications to all superadmins
		try {
			const superadmins = await User.find({ isSuperAdmin: true });

			// Send email to each superadmin
			for (const superadmin of superadmins) {
				if (superadmin.email) {
					await sendAdminApplicationNotification(
						superadmin.email,
						name,
						user.email,
						organization,
						sessions
					);
				}
			}
		} catch (emailError) {
			// Log error but don't fail the request
			log.warn("Failed to send admin application emails", { error: emailError.message });
		}

		return res.status(200).json({
			message:
				"Your admin application has been submitted. A superadmin will review it shortly.",
		});
	} catch (error) {
		log.error("Failed to process admin application", { error: error.message });
		return res.status(500).json({ message: "An error occurred" });
	}
}
