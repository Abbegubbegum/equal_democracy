import dbConnect from "@/lib/mongodb";
import { Session, Proposal, ThumbsUp } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import broadcaster from "@/lib/sse-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("Sessions");

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		// Get sessionId from request body (optional for backward compatibility)
		const { sessionId, topCount: requestedTopCount } = req.body;

		// Get active session (with optional sessionId)
		const activeSession = sessionId
			? await Session.findOne({ _id: sessionId, status: "active" })
			: await Session.findOne({ status: "active" });

		if (!activeSession) {
			return res.status(404).json({ error: "No active session found" });
		}

		if (activeSession.phase === "phase1") {
			// Transition from Phase 1 to Phase 2
			// Check if we have at least 2 proposals
			const proposalCount = await Proposal.countDocuments({
				sessionId: activeSession._id,
				status: "active",
			});

			if (proposalCount < 2) {
				return res.status(400).json({
					error: `Atleast 2 proposals are required to transition. Current count: ${proposalCount}`,
				});
			}

			// Use requested topCount if provided, otherwise use 40% formula
			const formulaCount = Math.min(
				proposalCount,
				Math.max(2, Math.ceil(proposalCount * 0.4))
			);
			const topCount = requestedTopCount
				? Math.max(2, Math.min(proposalCount, parseInt(requestedTopCount)))
				: formulaCount;

			// Get proposals sorted by average rating
			const proposals = await Proposal.find({
				sessionId: activeSession._id,
				status: "active",
			}).lean();

			// Calculate average rating for each if not already set
			for (const proposal of proposals) {
				if (!proposal.averageRating) {
					const ratings = await ThumbsUp.find({
						proposalId: proposal._id,
					});
					if (ratings.length > 0) {
						const avgRating =
							ratings.reduce(
								(sum, r) => sum + (r.rating || 5),
								0
							) / ratings.length;
						await Proposal.findByIdAndUpdate(proposal._id, {
							averageRating: avgRating,
							thumbsUpCount: ratings.length,
						});
					}
				}
			}

			// Re-fetch proposals with updated ratings
			const updatedProposals = await Proposal.find({
				sessionId: activeSession._id,
				status: "active",
			})
				.sort({ averageRating: -1, thumbsUpCount: -1 })
				.lean();

			// Move top proposals to "top3" status
			const topProposalIds = updatedProposals
				.slice(0, topCount)
				.map((p) => p._id);

			await Proposal.updateMany(
				{ _id: { $in: topProposalIds } },
				{ status: "top3" }
			);

			// Archive the rest
			const archivedIds = updatedProposals
				.slice(topCount)
				.map((p) => p._id);
			await Proposal.updateMany(
				{ _id: { $in: archivedIds } },
				{ status: "archived" }
			);

			// Update session to phase 2 and record start time
			activeSession.phase = "phase2";
			activeSession.phase2StartTime = new Date();
			await activeSession.save();

			// Broadcast phase change to all connected clients
			await broadcaster.broadcast("phase-change", {
				phase: "phase2",
				sessionId: activeSession._id.toString(),
				topProposalsCount: topProposalIds.length,
			});

			return res.status(200).json({
				message: "Advanced to Phase 2",
				phase: "phase2",
				topProposalsCount: topProposalIds.length,
				archivedCount: archivedIds.length,
			});
		} else if (activeSession.phase === "phase2") {
			return res.status(400).json({
				error: "Already in Phase 2. Use close-session to finish.",
			});
		} else {
			return res.status(400).json({
				error: "Session is closed",
			});
		}
	} catch (error) {
		log.error("Failed to advance phase", { sessionId: req.body?.sessionId, error: error.message });
		return res.status(500).json({ error: "Failed to advance phase" });
	}
}
