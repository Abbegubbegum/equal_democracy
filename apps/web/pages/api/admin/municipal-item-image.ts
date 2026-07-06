import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { put, del } from "@vercel/blob";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { MunicipalMeeting, Question } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";

const log = createLogger("AdminMunicipalItemImage");

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

  const meetingId = Array.isArray(fields.meetingId)
    ? fields.meetingId[0]
    : fields.meetingId;
  const itemId = Array.isArray(fields.itemId)
    ? fields.itemId[0]
    : fields.itemId;
  const file = Array.isArray(files.image) ? files.image[0] : files.image;

  if (!file || !meetingId || !itemId) {
    return res
      .status(400)
      .json({ message: "Missing image, meetingId or itemId" });
  }

  try {
    await connectDB();

    const meeting = await MunicipalMeeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Mötet hittades inte." });
    }

    const item = meeting.items.find(
      (it: any) => String(it._id) === String(itemId),
    );
    if (!item) {
      return res.status(404).json({ message: "Ärendet hittades inte." });
    }

    const ext = path.extname(file.originalFilename ?? ".jpg") || ".jpg";
    const blobPath = `municipal-item-images/${itemId}-${Date.now()}${ext}`;
    const buffer = await fs.promises.readFile(file.filepath);

    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType: file.mimetype ?? "image/jpeg",
    });

    fs.promises.unlink(file.filepath).catch(() => {});

    if (item.imageUrl && String(item.imageUrl).startsWith("http")) {
      del(item.imageUrl).catch(() => {});
    }

    item.imageUrl = url;
    await meeting.save();

    // Keep the spawned Question's image in sync, if the item was activated
    if (item.questionId) {
      await Question.findByIdAndUpdate(item.questionId, { imageUrl: url });
    }

    return res.status(200).json({ imageUrl: url });
  } catch (err: any) {
    log.error("Municipal item image upload failed", {
      meetingId,
      itemId,
      error: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({
      message: `Uppladdning misslyckades: ${err?.message || "okänt fel"}`,
    });
  }
}
