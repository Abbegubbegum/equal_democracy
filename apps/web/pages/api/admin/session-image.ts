import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Session } from "../../../lib/models";

export const config = { api: { bodyParser: false } };

const UPLOAD_DIR = path.join(process.cwd(), "public", "session-images");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const form = formidable({
    uploadDir: UPLOAD_DIR,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    filter: ({ mimetype }) => !!mimetype?.startsWith("image/"),
  });

  const [fields, files] = await form.parse(req);
  const sessionId = Array.isArray(fields.sessionId) ? fields.sessionId[0] : fields.sessionId;
  const file = Array.isArray(files.image) ? files.image[0] : files.image;

  if (!file || !sessionId) {
    return res.status(400).json({ message: "Missing image or sessionId" });
  }

  const filename = `${sessionId}${path.extname(file.originalFilename ?? ".jpg")}`;
  const dest = path.join(UPLOAD_DIR, filename);

  // Replace any previous image for this session
  fs.renameSync(file.filepath, dest);

  const imageUrl = `/session-images/${filename}`;

  await connectDB();
  await Session.findByIdAndUpdate(sessionId, { imageUrl });

  return res.status(200).json({ imageUrl });
}
