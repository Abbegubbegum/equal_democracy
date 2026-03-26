import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User, MunicipalSession, Proposal, Session, Comment } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { sendMunicipalSessionNotifications } from "../../../lib/municipal/notifications";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MunicipalSessions");

/**
 * GET/PATCH/DELETE /api/municipal/sessions
 * Manage municipal sessions
 * GET: Requires login
 * PATCH/DELETE: Superadmin only
 */
export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	const user = await User.findById(session.user.id);

	// GET - List all municipal sessions (any logged-in user)
	if (req.method === "GET") {
		try {
			const { status, limit, municipality } = req.query;

			const query = {};
			if (status) {
				query.status = status;
			}
			if (municipality) {
				query.municipality = municipality.charAt(0).toUpperCase() + municipality.slice(1);
			}

			const sessions = await MunicipalSession.find(query)
				.populate("createdBy", "name email")
				.sort({ meetingDate: -1 })
				.limit(limit ? parseInt(limit) : 50);

			return res.status(200).json({ sessions });
		} catch (error) {
			log.error("Failed to fetch sessions", { error: error.message });
			return res.status(500).json({ message: "Failed to fetch sessions" });
		}
	}

	// PATCH - Update municipal session (or publish it) - Superadmin only
	if (req.method === "PATCH") {
		if (!user || !user.isSuperAdmin) {
			return res.status(403).json({ message: "Superadmin access required" });
		}

		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const { sessionId, action, updates } = req.body;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID required" });
			}

			const municipalSession = await MunicipalSession.findById(sessionId);

			if (!municipalSession) {
				return res.status(404).json({ message: "Session not found" });
			}

			// Action: Publish (create sessions and proposals for each item)
			if (action === "publish") {
				if (municipalSession.status !== "draft") {
					return res.status(400).json({ message: "Only draft sessions can be published" });
				}

				// Format date for Session place field
				const meetingDateObj = new Date(municipalSession.meetingDate);
				const formattedDate = meetingDateObj.toISOString().slice(0, 10); // YYYY-MM-DD

				// Create a standard Session and Proposals for each item
				for (let i = 0; i < municipalSession.items.length; i++) {
					const item = municipalSession.items[i];

					// Create Session place: "2026-01-19 - Item Title" (max 100 chars)
					const maxTitleLength = 100 - formattedDate.length - 3; // "YYYY-MM-DD - " = 13 chars
					const truncatedTitle = item.title.length > maxTitleLength
						? item.title.substring(0, maxTitleLength - 3) + "..."
						: item.title;
					const sessionPlace = `${formattedDate} - ${truncatedTitle}`;

					// Create a Session for this item (phase2 + voting)
					const itemSession = new Session({
						place: sessionPlace,
						sessionType: "municipal",
						status: "active",
						phase: "phase2", // Skip phase1, go straight to debate
						createdBy: user._id,
						startDate: new Date(),
						showUserCount: true,
						noMotivation: false,
					});

					await itemSession.save();

					// Create a Proposal for this item
					const proposal = new Proposal({
						sessionId: itemSession._id,
						title: item.title,
						problem: "", // Description goes in initial arguments instead
						solution: item.description,
						authorId: user._id,
						authorName: municipalSession.meetingType,
						status: "top3", // Immediately promote to voting
					});

					await proposal.save();

					// Create initial arguments as Comments
					for (const arg of item.initialArguments || []) {
						const comment = new Comment({
							proposalId: proposal._id,
							sessionId: itemSession._id,
							userId: user._id,
							authorName: municipalSession.meetingType,
							text: arg.text,
							type: arg.type,
						});

						await comment.save();
					}

					// Update the item with references
					item.proposalId = proposal._id;
					item.sessionId = itemSession._id;
					item.status = "active";
				}

				municipalSession.status = "active";
				await municipalSession.save();

				log.info("Session published", {
					sessionId,
					itemCount: municipalSession.items.length
				});

				// Send notifications to users based on categories
				try {
					const notificationResults = await sendMunicipalSessionNotifications(municipalSession);
					log.info("Notifications sent", {
						sessionId,
						emails: notificationResults.emailsSent,
						sms: notificationResults.smsSent
					});
					municipalSession.notificationsSent = true;
					await municipalSession.save();
				} catch (error) {
					log.error("Failed to send notifications", { sessionId, error: error.message });
					// Don't fail the entire publish if notifications fail
				}

				return res.status(200).json({
					message: "Session published successfully",
					session: municipalSession,
				});
			}

			// Action: Update items or session details
			if (action === "update") {
				if (updates.name) municipalSession.name = updates.name;
				if (updates.meetingDate) municipalSession.meetingDate = new Date(updates.meetingDate);
				if (updates.meetingType) municipalSession.meetingType = updates.meetingType;
				if (updates.items) municipalSession.items = updates.items;

				await municipalSession.save();

				return res.status(200).json({
					message: "Session updated successfully",
					session: municipalSession,
				});
			}

			return res.status(400).json({ message: "Invalid action" });
		} catch (error) {
			log.error("Failed to update session", { error: error.message });
			return res.status(500).json({
				message: "Failed to update session",
				error: error.message,
			});
		}
	}

	// DELETE - Delete municipal session - Superadmin only
	if (req.method === "DELETE") {
		if (!user || !user.isSuperAdmin) {
			return res.status(403).json({ message: "Superadmin access required" });
		}

		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const { sessionId } = req.query;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID required" });
			}

			const municipalSession = await MunicipalSession.findById(sessionId);

			if (!municipalSession) {
				return res.status(404).json({ message: "Session not found" });
			}

			// Only allow deletion of draft sessions
			if (municipalSession.status !== "draft") {
				return res.status(400).json({ message: "Only draft sessions can be deleted" });
			}

			await MunicipalSession.findByIdAndDelete(sessionId);

			return res.status(200).json({ message: "Session deleted successfully" });
		} catch (error) {
			log.error("Failed to delete session", { error: error.message });
			return res.status(500).json({ message: "Failed to delete session" });
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
