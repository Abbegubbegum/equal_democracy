import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { CitizenProposal, CitizenProposalRating } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("CitizenProposalRate");

/**
 * POST/GET /api/citizen-proposals/rate
 * Rate a citizen proposal with 1-5 stars
 */
export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	// GET - Get user's rating for a proposal
	if (req.method === "GET") {
		try {
			const { proposalId } = req.query;

			if (!proposalId) {
				return res.status(400).json({ message: "Proposal ID required" });
			}

			const rating = await CitizenProposalRating.findOne({
				proposalId,
				userId: session.user.id,
			});

			return res.status(200).json({
				userRating: rating ? rating.rating : null,
			});
		} catch (error) {
			log.error("Failed to fetch rating", { proposalId: req.query.proposalId, error: error.message });
			return res.status(500).json({ message: "Failed to fetch rating" });
		}
	}

	// POST - Rate a proposal
	if (req.method === "POST") {
		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const { proposalId, rating } = req.body;

			if (!proposalId || !rating) {
				return res.status(400).json({
					message: "Proposal ID and rating are required",
				});
			}

			if (rating < 1 || rating > 5) {
				return res.status(400).json({
					message: "Rating must be between 1 and 5",
				});
			}

			// Check if proposal exists
			const proposal = await CitizenProposal.findById(proposalId);

			if (!proposal) {
				return res.status(404).json({ message: "Proposal not found" });
			}

			if (proposal.status !== "active") {
				return res.status(400).json({
					message: "Cannot rate inactive proposals",
				});
			}

			// Check if user has already rated
			let existingRating = await CitizenProposalRating.findOne({
				proposalId,
				userId: session.user.id,
			});

			let oldRating = 0;

			if (existingRating) {
				// Update existing rating
				oldRating = existingRating.rating;
				existingRating.rating = rating;
				await existingRating.save();
			} else {
				// Create new rating
				existingRating = new CitizenProposalRating({
					proposalId,
					userId: session.user.id,
					rating,
				});
				await existingRating.save();
			}

			// Recalculate proposal stats
			const allRatings = await CitizenProposalRating.find({ proposalId });

			const totalStars = allRatings.reduce((sum, r) => sum + r.rating, 0);
			const ratingCount = allRatings.length;
			const averageRating = ratingCount > 0 ? totalStars / ratingCount : 0;

			proposal.totalStars = totalStars;
			proposal.ratingCount = ratingCount;
			proposal.averageRating = averageRating;

			await proposal.save();

			log.info("Proposal rated", { userId: session.user.id, proposalId, oldRating, newRating: rating, totalStars });

			return res.status(200).json({
				message: oldRating ? "Rating updated" : "Rating registered",
				totalStars,
				ratingCount,
				averageRating,
				userRating: rating,
			});
		} catch (error) {
			log.error("Failed to rate proposal", { proposalId: req.body.proposalId, error: error.message });
			return res.status(500).json({
				message: "Failed to rate proposal",
				error: error.message,
			});
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
