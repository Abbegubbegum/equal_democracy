import dbConnect from "@/lib/mongodb";
import { User, Settings } from "@/lib/models";
import { sendBroadcastEmail } from "@/lib/email";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("BroadcastEmail");

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// Check if user is admin
	const session = await getServerSession(req, res, authOptions);
	if (!session || !session.user?.isAdmin) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { subject, message } = req.body;

		// Get current language setting
		const settings = await Settings.findOne();
		const language = settings?.language || "sv";

		if (!subject || !message) {
			return res
				.status(400)
				.json({ error: "Subject and message are required" });
		}

		// Get all users
		const users = await User.find({});

		// Send email to each user
		let successCount = 0;
		let errorCount = 0;

		for (const user of users) {
			try {
				await sendBroadcastEmail(user.email, subject, message, language);
				successCount++;
			} catch (emailError) {
				log.error("Failed to send broadcast email", { email: user.email, error: emailError.message });
				errorCount++;
			}
		}

		log.info("Broadcast emails completed", { total: users.length, success: successCount, errors: errorCount });

		return res.status(200).json({
			message: "Broadcast emails sent",
			totalUsers: users.length,
			successCount,
			errorCount,
		});
	} catch (error) {
		log.error("Broadcast email operation failed", { error: error.message });
		return res
			.status(500)
			.json({ error: "Failed to send broadcast emails" });
	}
}
