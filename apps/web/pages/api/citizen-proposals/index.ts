import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User, CitizenProposal, CitizenProposalRating } from "../../../lib/models";
import { csrfProtection } from "../../../lib/csrf";
import { createLogger } from "../../../lib/logger";

const log = createLogger("CitizenProposals");

/**
 * GET/POST /api/citizen-proposals
 * List and create citizen proposals
 */
export default async function handler(req, res) {
	await connectDB();

	const session = await getServerSession(req, res, authOptions);

	// GET - List all active citizen proposals (public, no auth required)
	if (req.method === "GET") {
		try {
			const { status, category, sort } = req.query;

			const query = {};

			// Filter by status (default: active; "all" returns everything)
			if (status && status !== "all") {
				query.status = status;
			} else if (!status) {
				query.status = "active";
			}

			// Filter by category
			if (category) {
				query.categories = parseInt(category);
			}

			// Determine sort order
			let sortQuery = {};
			if (sort === "recent") {
				sortQuery = { createdAt: -1 };
			} else {
				// Default: sort by total stars (most popular first)
				sortQuery = { totalStars: -1, createdAt: -1 };
			}

			const proposals = await CitizenProposal.find(query)
				.sort(sortQuery)
				.limit(100)
				.lean();

			// If user is logged in, include their ratings
			if (session?.user?.id) {
				const userRatings = await CitizenProposalRating.find({
					userId: session.user.id,
					proposalId: { $in: proposals.map(p => p._id) },
				}).lean();

				const ratingsMap = {};
				userRatings.forEach(r => {
					ratingsMap[r.proposalId.toString()] = r.rating;
				});

				// Add user ratings to proposals
				proposals.forEach(p => {
					p.userRating = ratingsMap[p._id.toString()] || null;
					p.isOwn = p.authorId.toString() === session.user.id;
				});
			} else {
				proposals.forEach(p => {
					p.userRating = null;
					p.isOwn = false;
				});
			}

			return res.status(200).json({ proposals });
		} catch (error) {
			log.error("Failed to fetch proposals", { error: error.message });
			return res.status(500).json({ message: "Failed to fetch proposals" });
		}
	}

	// POST - Create new citizen proposal (requires auth)
	if (req.method === "POST") {
		if (!session) {
			return res.status(401).json({ message: "You must be logged in" });
		}

		if (!csrfProtection(req, res)) {
			return;
		}

		try {
			const { title, description, categories } = req.body;

			// Validation
			if (!title || !description || !categories || categories.length === 0) {
				return res.status(400).json({
					message: "Title, description, and at least one category are required",
				});
			}

			if (title.length > 200) {
				return res.status(400).json({
					message: "Title cannot be more than 200 characters",
				});
			}

			if (description.length > 2000) {
				return res.status(400).json({
					message: "Description cannot be more than 2000 characters",
				});
			}

			if (categories.length > 3) {
				return res.status(400).json({
					message: "Maximum 3 categories allowed",
				});
			}

			// Validate category numbers
			for (const cat of categories) {
				if (cat < 1 || cat > 7) {
					return res.status(400).json({
						message: "Invalid category. Must be 1-7",
					});
				}
			}

			const user = await User.findById(session.user.id);

			if (!user) {
				return res.status(404).json({ message: "User not found" });
			}

			// Create proposal
			const proposal = new CitizenProposal({
				title,
				description,
				categories,
				authorId: user._id,
				authorName: user.name,
				status: "active",
				totalStars: 0,
				ratingCount: 0,
				averageRating: 0,
			});

			await proposal.save();

			log.info("Proposal created", { proposalId: proposal._id.toString(), author: user.name });

			return res.status(201).json({
				message: "Proposal created successfully",
				proposal: {
					_id: proposal._id,
					title: proposal.title,
					description: proposal.description,
					categories: proposal.categories,
					totalStars: proposal.totalStars,
					isOwn: true,
				},
			});
		} catch (error) {
			log.error("Failed to create proposal", { error: error.message });
			return res.status(500).json({
				message: "Failed to create proposal",
				error: error.message,
			});
		}
	}

	return res.status(405).json({ message: "Method not allowed" });
}
