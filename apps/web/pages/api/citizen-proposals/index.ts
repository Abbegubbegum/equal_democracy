import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import {
  User,
  CitizenProposal,
  CitizenProposalRating,
} from "../../../lib/models";
import { ALL_CATEGORIES, INTEREST_TO_CATEGORIES } from "@repo/types";
import { csrfProtection } from "../../../lib/csrf";
import { getRatingAggregates } from "../../../lib/rating-helper";
import { rankActiveProposals } from "../../../lib/forslag-ranking";
import { createLogger } from "../../../lib/logger";

const log = createLogger("CitizenProposals");

// The `category` query param is an INTEREST_AREAS key (from the filter
// dropdown). Expand it to the raw categories stored on proposals and match any
// of them. Falls back to an exact match so a raw category value still works.
function categoryFilter(category: string): unknown {
  const mapped = INTEREST_TO_CATEGORIES[category];
  return mapped && mapped.length ? { $in: mapped } : category;
}

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

  // GET - List the active proposal stack, ranked by score (public, no auth)
  if (req.method === "GET") {
    try {
      const { category, status } = req.query;

      // Archive / non-stack view (e.g. Arkiv Hem tab): any status (or "all"),
      // newest first, no ranking. Includes the fullmäktige outcome fields.
      if (status && status !== "active") {
        const q: Record<string, unknown> = {};
        if (status !== "all") q.status = String(status);
        if (category) q.categories = categoryFilter(String(category));

        const raw = (await CitizenProposal.find(q)
          .sort({ createdAt: -1 })
          .lean()) as any[];
        const ratings = await getRatingAggregates(
          CitizenProposalRating,
          "proposalId",
          raw.map((p) => p._id),
        );
        const ratingsMap: Record<string, number> = {};
        if (session?.user?.id) {
          const ur = await CitizenProposalRating.find({
            userId: session.user.id,
            proposalId: { $in: raw.map((p) => p._id) },
          }).lean();
          ur.forEach((r) => {
            ratingsMap[r.proposalId.toString()] = r.rating;
          });
        }

        const proposals = raw.map((p) => {
          const agg = ratings.get(p._id.toString());
          return {
            ...p,
            averageRating: agg?.averageRating || 0,
            ratingCount: agg?.ratingCount || 0,
            userRating: ratingsMap[p._id.toString()] || null,
            isOwn: session?.user?.id
              ? p.authorId?.toString() === session.user.id
              : false,
          };
        });
        return res.status(200).json({ proposals });
      }

      // The public stack is the active proposals only — motion/archived have
      // already left it. Ranked by score = ratingCount × avg³ (shared helper).
      const query: Record<string, unknown> = { status: "active" };
      if (category) {
        query.categories = categoryFilter(String(category));
      }

      const rawProposals = (await CitizenProposal.find(query).lean()) as any[];
      const ratings = await getRatingAggregates(
        CitizenProposalRating,
        "proposalId",
        rawProposals.map((p) => p._id),
      );

      const ranked = rankActiveProposals(rawProposals, ratings).slice(0, 100);

      // Attach the viewer's own rating (if logged in).
      const ratingsMap: Record<string, number> = {};
      if (session?.user?.id) {
        const userRatings = await CitizenProposalRating.find({
          userId: session.user.id,
          proposalId: { $in: ranked.map((p) => p._id) },
        }).lean();
        userRatings.forEach((r) => {
          ratingsMap[r.proposalId.toString()] = r.rating;
        });
      }

      const proposals = ranked.map((p) => ({
        ...p,
        userRating: ratingsMap[p._id.toString()] || null,
        isOwn: session?.user?.id
          ? p.authorId?.toString() === session.user.id
          : false,
      }));

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
