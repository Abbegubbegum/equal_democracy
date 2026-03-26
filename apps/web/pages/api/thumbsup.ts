import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "../../lib/mongodb";
import { ThumbsUp, Proposal } from "../../lib/models";
import { getActiveSession, registerActiveUser } from "../../lib/session-helper";
import { csrfProtection } from "../../lib/csrf";
import broadcaster from "../../lib/sse-broadcaster";
import { createLogger } from "@/lib/logger";

const log = createLogger("ThumbsUp");

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	if (req.method === "POST") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res
				.status(401)
				.json({ message: "You have to be logged in" });
		}

		const { proposalId, rating, sessionId } = req.body;

		if (!proposalId) {
			return res.status(400).json({ message: "Proposal ID is required" });
		}

		// Validate rating (1-5)
		if (rating && (rating < 1 || rating > 5)) {
			return res
				.status(400)
				.json({ message: "Rating must be between 1 and 5" });
		}

		try {
			// Get the active session (with optional sessionId)
			const activeSession = await getActiveSession(sessionId);

			// If no active session, cannot rate
			if (!activeSession) {
				return res
					.status(400)
					.json({ message: "No active session exists" });
			}

			const existingVote = await ThumbsUp.findOne({
				proposalId,
				userId: session.user.id,
			});

			if (existingVote) {
				// Update existing rating
				existingVote.rating = rating || 5;
				await existingVote.save();

				// Recalculate average rating
				const ratings = await ThumbsUp.find({ proposalId });
				const avgRating =
					ratings.reduce((sum, r) => sum + r.rating, 0) /
					ratings.length;
				const count = ratings.length;

				await Proposal.findByIdAndUpdate(proposalId, {
					thumbsUpCount: count,
					averageRating: avgRating,
				});

				// Broadcast rating update event
				await broadcaster.broadcast("rating-update", {
					proposalId: proposalId.toString(),
					thumbsUpCount: count,
					averageRating: avgRating,
				});

				return res.status(200).json({
					message: "Rating uppdated",
					count,
					averageRating: avgRating,
					userRating: existingVote.rating,
				});
			}

			// Create new rating
			await ThumbsUp.create({
				sessionId: activeSession._id,
				proposalId,
				userId: session.user.id,
				rating: rating || 5,
			});

			// Register user as active in session
			await registerActiveUser(session.user.id, activeSession._id.toString());

			// Calculate average rating
			const ratings = await ThumbsUp.find({ proposalId });
			const avgRating =
				ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
			const count = ratings.length;

			await Proposal.findByIdAndUpdate(proposalId, {
				thumbsUpCount: count,
				averageRating: avgRating,
			});

			// Broadcast rating update event
			await broadcaster.broadcast("rating-update", {
				proposalId: proposalId.toString(),
				thumbsUpCount: count,
				averageRating: avgRating,
			});

			return res.status(201).json({
				message: "Rating registered",
				count,
				averageRating: avgRating,
				userRating: rating || 5,
			});
		} catch (error) {
			log.error("Failed to add thumbs up", { proposalId: req.body.proposalId, error: error.message });
			return res.status(500).json({ message: "An error has occured" });
		}
	}

	if (req.method === "GET") {
		const session = await getServerSession(req, res, authOptions);

		if (!session) {
			return res
				.status(401)
				.json({ message: "You have to be logged in" });
		}

		const { proposalId } = req.query;

		if (proposalId) {
			const vote = await ThumbsUp.findOne({
				proposalId,
				userId: session.user.id,
			});

			return res.status(200).json({
				voted: !!vote,
				rating: vote ? vote.rating : 0,
			});
		}

		const votes = await ThumbsUp.find({ userId: session.user.id })
			.populate("proposalId")
			.lean();

		return res.status(200).json(votes);
	}

	return res.status(405).json({ message: "Method not allowed" });
}
