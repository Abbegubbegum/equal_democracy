import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { put, del } from "@vercel/blob";
import connectDB from "../../../../lib/mongodb";
import { CitizenProposal, CitizenProposalRating } from "../../../../lib/models";
import { verifyBearerToken } from "../../../../lib/mobile-jwt";
import { ALL_CATEGORIES } from "@repo/types";
import { createLogger } from "../../../../lib/logger";

export const config = { api: { bodyParser: false } };

const log = createLogger("MobileCitizenProposals");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await connectDB();

  if (req.method === "POST") {
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
        authorId: user.id,
        authorName: user.name || user.email,
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
    const proposals = await CitizenProposal.find({
      status: { $in: ["active", "selected", "submitted_as_motion"] },
    })
      .select(
        "_id title description authorName imageUrl averageRating ratingCount status createdAt",
      )
      .sort({ averageRating: -1, ratingCount: -1, createdAt: -1 })
      .lean();

    const proposalIds = proposals.map((p) => p._id);
    const userRatings = await CitizenProposalRating.find({
      proposalId: { $in: proposalIds },
      userId: user.id,
    }).lean();
    const ratingMap = Object.fromEntries(
      userRatings.map((r) => [r.proposalId.toString(), r.rating]),
    );

    return res.status(200).json(
      proposals.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        description: p.description,
        imageUrl: (p as any).imageUrl ?? null,
        status: p.status,
        averageRating: p.averageRating || 0,
        ratingCount: p.ratingCount || 0,
        userRating: ratingMap[p._id.toString()] || 0,
      })),
    );
  } catch (error) {
    log.error("Failed to fetch citizen proposals", { error: error.message });
    return res.status(500).json({ message: "Failed to fetch proposals" });
  }
}
