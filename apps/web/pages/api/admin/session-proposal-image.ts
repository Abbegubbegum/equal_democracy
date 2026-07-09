import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { put, del } from "@vercel/blob";
import { compressImage } from "@/lib/image";
import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/mongodb";
import { Proposal } from "@/lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminSessionProposalImage");

export const config = { api: { bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await requireAdmin(req, res);
  if (!session) return;

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    filter: ({ mimetype }) => !!mimetype?.startsWith("image/"),
  });

  let fields: formidable.Fields;
  let files: formidable.Files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err: any) {
    if (err?.code === 1009 || err?.code === 1016) {
      return res.status(413).json({
        message: "Bilden är för stor, försök spara i mindre format (max 5 MB).",
      });
    }
    return res.status(400).json({ message: "Kunde inte läsa bilden." });
  }

  const proposalId = Array.isArray(fields.proposalId)
    ? fields.proposalId[0]
    : fields.proposalId;
  const file = Array.isArray(files.image) ? files.image[0] : files.image;

  if (!file || !proposalId) {
    return res.status(400).json({ message: "Missing image or proposalId" });
  }

  try {
    await connectDB();

    const blobPath = `session-proposal-images/${proposalId}-${Date.now()}.jpg`;
    const raw = await fs.promises.readFile(file.filepath);
    const buffer = await compressImage(raw);

    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    fs.promises.unlink(file.filepath).catch(() => {});

    const existing = await Proposal.findById(proposalId)
      .select("imageUrl")
      .lean<{ imageUrl?: string | null } | null>();
    if (existing?.imageUrl && existing.imageUrl.startsWith("http")) {
      del(existing.imageUrl).catch(() => {});
    }

    const updated = await Proposal.findByIdAndUpdate(
      proposalId,
      { imageUrl: url },
      { new: true },
    );
    if (!updated) {
      log.error("Proposal not found after blob upload", { proposalId });
      return res.status(404).json({ message: "Förslaget hittades inte." });
    }

    return res.status(200).json({ imageUrl: url });
  } catch (err: any) {
    log.error("Session proposal image upload failed", {
      proposalId,
      error: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({
      message: `Uppladdning misslyckades: ${err?.message || "okänt fel"}`,
    });
  }
}
