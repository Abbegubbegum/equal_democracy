import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { put, del } from "@vercel/blob";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Session } from "../../../lib/models";

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

  const [fields, files] = await form.parse(req);
  const sessionId = Array.isArray(fields.sessionId)
    ? fields.sessionId[0]
    : fields.sessionId;
  const file = Array.isArray(files.image) ? files.image[0] : files.image;

  if (!file || !sessionId) {
    return res.status(400).json({ message: "Missing image or sessionId" });
  }

  await connectDB();

  const ext = path.extname(file.originalFilename ?? ".jpg") || ".jpg";
  const blobPath = `session-images/${sessionId}-${Date.now()}${ext}`;
  const buffer = await fs.promises.readFile(file.filepath);

  const { url } = await put(blobPath, buffer, {
    access: "public",
    contentType: file.mimetype ?? "image/jpeg",
  });

  // Clean up the temp file formidable wrote to /tmp.
  fs.promises.unlink(file.filepath).catch(() => {});

  // Remove the previous blob for this session so we don't accumulate orphans.
  const existing = await Session.findById(sessionId).select("imageUrl").lean<{
    imageUrl?: string | null;
  } | null>();
  if (existing?.imageUrl && existing.imageUrl.startsWith("http")) {
    del(existing.imageUrl).catch(() => {});
  }

  await Session.findByIdAndUpdate(sessionId, { imageUrl: url });

  return res.status(200).json({ imageUrl: url });
}
