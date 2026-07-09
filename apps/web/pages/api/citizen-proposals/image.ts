import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { put, del } from "@vercel/blob";
import { compressImage } from "@/lib/image";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { CitizenProposal } from "@/lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("CitizenProposalImage");

export const config = { api: { bodyParser: false } };

/**
 * POST /api/citizen-proposals/image
 * Author uploads/replaces the image on their OWN citizen proposal (session
 * auth). Mirrors the admin image endpoint but gated on authorId, so the MAJ
 * "add an image" prompt works during submission.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id)
    return res.status(401).json({ message: "Unauthorized" });

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024,
    filter: ({ mimetype }) => !!mimetype?.startsWith("image/"),
  });

  let fields: formidable.Fields;
  let files: formidable.Files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err: any) {
    if (err?.code === 1009 || err?.code === 1016) {
      return res
        .status(413)
        .json({ message: "Bilden är för stor (max 5 MB)." });
    }
    return res.status(400).json({ message: "Kunde inte läsa bilden." });
  }

  const proposalId = Array.isArray(fields.proposalId)
    ? fields.proposalId[0]
    : fields.proposalId;
  const file = Array.isArray(files.image) ? files.image[0] : files.image;
  if (!file || !proposalId)
    return res.status(400).json({ message: "Missing image or proposalId" });

  try {
    await connectDB();

    const proposal = await CitizenProposal.findById(proposalId)
      .select("authorId imageUrl")
      .lean<{ authorId?: any; imageUrl?: string | null } | null>();
    if (!proposal)
      return res.status(404).json({ message: "Förslaget hittades inte." });
    if (proposal.authorId?.toString() !== session.user.id) {
      return res
        .status(403)
        .json({ message: "Du får inte ändra det här förslaget." });
    }

    const blobPath = `citizen-proposal-images/${proposalId}-${Date.now()}.jpg`;
    const raw = await fs.promises.readFile(file.filepath);
    const buffer = await compressImage(raw);
    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType: "image/jpeg",
    });
    fs.promises.unlink(file.filepath).catch(() => {});

    if (proposal.imageUrl && proposal.imageUrl.startsWith("http")) {
      del(proposal.imageUrl).catch(() => {});
    }

    await CitizenProposal.findByIdAndUpdate(proposalId, { imageUrl: url });
    return res.status(200).json({ imageUrl: url });
  } catch (err: any) {
    log.error("Citizen proposal image upload failed", {
      proposalId,
      error: err?.message,
    });
    return res.status(500).json({
      message: `Uppladdning misslyckades: ${err?.message || "okänt fel"}`,
    });
  }
}
