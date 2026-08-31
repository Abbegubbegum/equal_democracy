import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { put, del } from "@vercel/blob";
import connectDB from "../../../../lib/mongodb";
import { CitizenProposal, CitizenProposalRating } from "../../../../lib/models";
import { getRatingAggregates } from "../../../../lib/rating-helper";
import { rankActiveProposals } from "../../../../lib/forslag-ranking";
import { optionalBearerToken } from "../../../../lib/mobile-jwt";
import { requireParticipant } from "../../../../lib/viewer";
import { ALL_CATEGORIES } from "@repo/types";
import { createLogger } from "../../../../lib/logger";

export const config = { api: { bodyParser: false } };

const log = createLogger("MobileCitizenProposals");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // GET is public — the Förslag stack is readable signed out. POST re-resolves
  // the caller through requireParticipant below, which consults the database
  // rather than the token, so a restricted or BankID-less account cannot submit.
  const user = optionalBearerToken(req.headers.authorization);

  await connectDB();

  const CITIZEN_PROPOSAL_LIMIT = 1;

  if (req.method === "POST") {
    const viewer = await requireParticipant(req, res);
    if (!viewer) return;

    if (!viewer.isAdmin) {
      const existing = await CitizenProposal.countDocuments({
        authorId: viewer.userId,
      });
      if (existing >= CITIZEN_PROPOSAL_LIMIT) {
        return res.status(403).json({
          message:
            "Du har redan lämnat ditt förslag — varje medlem får lämna ett förslag fram till valet den 13 september.",
        });
      }
    }

    const form = formidable({
      keepExtensions: true,
      maxFileSize: 600 * 1024, // 600 KB — mobile already compresses to ~max 500 KB
      filter: ({ mimetype }) => !!mimetype?.startsWith("image/"),
    });

    let fields: formidable.Fields;
    let files: formidable.Files;
    try {
      [fields, files] = await form.parse(req);
    } catch {
      return res
        .status(400)
        .json({ message: "Bilden är för stor (max 600 KB)" });
    }

    const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
    const description = Array.isArray(fields.description)
      ? fields.description[0]
      : fields.description;
    const categoriesRaw = Array.isArray(fields.categories)
      ? fields.categories[0]
      : fields.categories;

    if (!title?.trim()) return res.status(400).json({ message: "Titel krävs" });
    if (!description?.trim())
      return res.status(400).json({ message: "Beskrivning krävs" });

    let categories: string[] = [];
    if (categoriesRaw) {
      try {
        const parsed = JSON.parse(categoriesRaw);
        categories = (Array.isArray(parsed) ? parsed : [])
          .filter(
            (c): c is string =>
              typeof c === "string" &&
              (ALL_CATEGORIES as readonly string[]).includes(c),
          )
          .slice(0, 3);
      } catch {
        /* invalid JSON — use empty */
      }
    }

    const file = Array.isArray(files.image) ? files.image[0] : files.image;
    const id = new mongoose.Types.ObjectId();

    let imageUrl: string | null = null;
    if (file) {
      const ext =
        path.extname(file.originalFilename ?? "").toLowerCase() || ".jpg";
      const buffer = await fs.promises.readFile(file.filepath);
      const { url } = await put(`citizen-proposal-images/${id}${ext}`, buffer, {
        access: "public",
        contentType: file.mimetype ?? "image/jpeg",
      });
      imageUrl = url;
      fs.promises.unlink(file.filepath).catch(() => {});
    }

    try {
      const proposal = await CitizenProposal.create({
        _id: id,
        title: title.trim(),
        description: description.trim(),
        categories,
        authorId: viewer.userId,
        status: "active",
        ...(imageUrl && { imageUrl }),
      });

      return res.status(201).json({
        id: proposal._id.toString(),
        title: proposal.title,
        description: proposal.description,
        imageUrl: proposal.imageUrl ?? null,
        averageRating: 0,
        ratingCount: 0,
        userRating: 0,
      });
    } catch (error) {
      if (imageUrl) del(imageUrl).catch(() => {});
      log.error("Failed to create citizen proposal", { error: error.message });
      return res.status(500).json({ message: "Failed to create proposal" });
    }
  }

  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    // The Förslag stack is the active proposals only — motion/archived have
    // left it. Ranked by score = ratingCount × avg³ (shared with web + admin),
    // so mobile, web and the admin all agree on order + rank number.
    const proposals = await CitizenProposal.find({ status: "active" })
      .select("_id title description imageUrl status createdAt")
      .lean();

    const proposalIds = proposals.map((p) => p._id);
    const [ratings, userRatings, ownCount] = await Promise.all([
      getRatingAggregates(CitizenProposalRating, "proposalId", proposalIds),
      user
        ? CitizenProposalRating.find({
            proposalId: { $in: proposalIds },
            userId: user.id,
          }).lean()
        : [],
      user ? CitizenProposal.countDocuments({ authorId: user.id }) : 0,
    ]);
    const userRatingMap = Object.fromEntries(
      userRatings.map((r) => [r.proposalId.toString(), r.rating]),
    );
    // Advisory: it hides the submit button rather than granting anything. The
    // POST path re-checks against the database, so a stale `true` here costs a
    // rejected request, never a proposal that should not exist.
    const canSubmit =
      !!user && (user.isAdmin || ownCount < CITIZEN_PROPOSAL_LIMIT);

    const sortedProposals = rankActiveProposals(
      proposals as any[],
      ratings,
    ).map((p: any) => ({
      id: p._id.toString(),
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl ?? null,
      status: p.status,
      averageRating: p.averageRating,
      ratingCount: p.ratingCount,
      score: Math.round(p.score),
      rank: p.rank,
      userRating: userRatingMap[p._id.toString()] || 0,
      createdAt: p.createdAt,
    }));

    return res.status(200).json({
      proposals: sortedProposals,
      canSubmit,
    });
  } catch (error) {
    log.error("Failed to fetch citizen proposals", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch proposals" });
  }
}
