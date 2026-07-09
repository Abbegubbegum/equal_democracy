import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { put, del } from "@vercel/blob";
import { compressImage } from "../../../lib/image";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Question } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";

const log = createLogger("AdminQuestionImage");

export const config = { api: { bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

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
    log.error("Formidable parse failed", { error: err?.message });
    return res.status(400).json({ message: "Kunde inte läsa bilden." });
  }

  const questionId = Array.isArray(fields.questionId)
    ? fields.questionId[0]
    : fields.questionId;
  const file = Array.isArray(files.image) ? files.image[0] : files.image;

  if (!file || !questionId) {
    return res.status(400).json({ message: "Missing image or questionId" });
  }

  try {
    await connectDB();

    const blobPath = `question-images/${questionId}-${Date.now()}.jpg`;
    const raw = await fs.promises.readFile(file.filepath);
    const buffer = await compressImage(raw);

    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    // Clean up the temp file formidable wrote to /tmp.
    fs.promises.unlink(file.filepath).catch(() => {});

    // Remove the previous blob for this question so we don't accumulate orphans.
    const existing = await Question.findById(questionId)
      .select("imageUrl")
      .lean<{ imageUrl?: string | null } | null>();
    if (existing?.imageUrl && existing.imageUrl.startsWith("http")) {
      del(existing.imageUrl).catch(() => {});
    }

    const updated = await Question.findByIdAndUpdate(
      questionId,
      { imageUrl: url },
      { new: true },
    );
    if (!updated) {
      log.error("Question not found after blob upload", { questionId });
      return res.status(404).json({ message: "Frågan hittades inte." });
    }

    return res.status(200).json({ imageUrl: url });
  } catch (err: any) {
    log.error("Question image upload failed", {
      questionId,
      error: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({
      message: `Uppladdning misslyckades: ${err?.message || "okänt fel"}`,
    });
  }
}
