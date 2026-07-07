import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import {
  User,
  CitizenProposal,
  CitizenProposalRating,
} from "../../../lib/models";
import { ALL_CATEGORIES } from "@repo/types";
import { csrfProtection } from "../../../lib/csrf";
import { getRatingAggregates } from "../../../lib/rating-helper";
import { createLogger } from "../../../lib/logger";

const log = createLogger("CitizenProposals");

/**
 * GET/POST /api/citizen-proposals
 * List and create citizen proposals
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await connectDB();

  const session = await getServerSession(req, res, authOptions);

  // GET - List all active citizen proposals (public, no auth required)
  if (req.method === "GET") {
    try {
      const { status, category, sort } = req.query;

      const query: Record<string, unknown> = {};

      // Filter by status (default: show active + selected + submitted_as_motion;
      // "all" returns everything including rejected/archived)
      if (status && status !== "all") {
        query.status = String(status);
      } else if (!status) {
        query.status = { $in: ["active", "selected", "submitted_as_motion"] };
      }

      // Filter by category (string category name; matches array membership)
      if (category) {
        query.categories = String(category);
      }

      const rawProposals = (await CitizenProposal.find(query).lean()) as any[];
      const ratings = await getRatingAggregates(
        CitizenProposalRating,
        "proposalId",
        rawProposals.map((p) => p._id),
      );

      const proposals = rawProposals.map((p) => {
        const agg = ratings.get(p._id.toString());
        return {
          ...p,
          averageRating: agg?.averageRating || 0,
          ratingCount: agg?.ratingCount || 0,
        };
      });

      // Determine sort order
      if (sort === "recent") {
        proposals.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } else {
        // Default: sort by rating (most popular first)
        proposals.sort(
          (a, b) =>
            b.averageRating - a.averageRating ||
            b.ratingCount - a.ratingCount ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }
      const limitedProposals = proposals.slice(0, 100);

      // If user is logged in, include their ratings
      if (session?.user?.id) {
        const userRatings = await CitizenProposalRating.find({
          userId: session.user.id,
          proposalId: { $in: limitedProposals.map((p) => p._id) },
        }).lean();

        const ratingsMap = {};
        userRatings.forEach((r) => {
          ratingsMap[r.proposalId.toString()] = r.rating;
        });

        // Add user ratings to proposals
        limitedProposals.forEach((p) => {
          (p as any).userRating = ratingsMap[p._id.toString()] || null;
          (p as any).isOwn = p.authorId.toString() === session.user.id;
        });
      } else {
        limitedProposals.forEach((p) => {
          (p as any).userRating = null;
          (p as any).isOwn = false;
        });
      }

      return res.status(200).json({ proposals: limitedProposals });
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

      // Validate categories against the allowed set
      for (const cat of categories) {
        if (
          typeof cat !== "string" ||
          !(ALL_CATEGORIES as readonly string[]).includes(cat)
        ) {
          return res.status(400).json({ message: "Invalid category" });
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
        status: "active",
      });

      await proposal.save();

      log.info("Proposal created", {
        proposalId: proposal._id.toString(),
        author: user.name,
      });

      return res.status(201).json({
        message: "Proposal created successfully",
        proposal: {
          _id: proposal._id,
          title: proposal.title,
          description: proposal.description,
          categories: proposal.categories,
          status: proposal.status,
          averageRating: 0,
          ratingCount: 0,
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
