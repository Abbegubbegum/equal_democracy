import dbConnect from "@/lib/mongodb";
import { Settings } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("Settings");

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "GET") {
		try {
			// Get or create settings
			let settings = await Settings.findOne();

			if (!settings) {
				// Create default settings if none exist
				settings = await Settings.create({
					sessionLimitHours: 24,
					language: "sv",
					theme: "default",
				});
			}

			return res.status(200).json({
				sessionLimitHours: settings.sessionLimitHours || 24,
				language: settings.language || "sv",
				theme: settings.theme || "default",
			});
		} catch (error) {
			log.error("Failed to fetch settings", { error: error.message });
			return res.status(500).json({ error: "Failed to fetch settings" });
		}
	}

	if (req.method === "PUT" || req.method === "POST") {
		try {
			// Check if user is admin
			const session = await getServerSession(req, res, authOptions);
			if (!session || !session.user?.isAdmin) {
				return res.status(403).json({ error: "Unauthorized" });
			}

			const { sessionLimitHours, language, theme } = req.body;

			if (sessionLimitHours !== undefined) {
				const hours = Number(sessionLimitHours);
				if (isNaN(hours) || hours < 1 || hours > 168) {
					return res.status(400).json({
						error: "Session limit must be between 1 and 168 hours",
					});
				}
			}

			if (
				language &&
				!["sv", "en", "sr", "es", "de"].includes(language)
			) {
				return res.status(400).json({
					error: "Invalid language (must be sv, en, sr, es, or de)",
				});
			}

			if (theme && !["default", "green", "red", "blue"].includes(theme)) {
				return res.status(400).json({
					error: "Invalid theme (must be default, green, red, or blue)",
				});
			}

			// Update or create settings
			let settings = await Settings.findOne();

			if (!settings) {
				settings = await Settings.create({
					sessionLimitHours: sessionLimitHours || 24,
					language: language || "sv",
					theme: theme || "default",
				});
			} else {
				if (sessionLimitHours !== undefined) {
					settings.sessionLimitHours = Number(sessionLimitHours);
				}
				if (language) {
					settings.language = language;
				}
				if (theme) {
					settings.theme = theme;
				}
				settings.updatedAt = new Date();
				await settings.save();
			}

			return res.status(200).json({
				sessionLimitHours: settings.sessionLimitHours,
				language: settings.language,
				theme: settings.theme,
			});
		} catch (error) {
			log.error("Failed to update settings", { error: error.message });
			return res.status(500).json({ error: "Failed to update settings" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
