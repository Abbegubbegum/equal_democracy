import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { put, del } from "@vercel/blob";
import { compressImage } from "../../../lib/image";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { BudgetSession } from "../../../lib/models";
import { createLogger } from "../../../lib/logger";

const log = createLogger("AdminBudgetCategoryImage");

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

  const sessionId = Array.isArray(fields.sessionId)
    ? fields.sessionId[0]
    : fields.sessionId;
  const categoryId = Array.isArray(fields.categoryId)
    ? fields.categoryId[0]
    : fields.categoryId;
  const file = Array.isArray(files.image) ? files.image[0] : files.image;

  if (!file || !sessionId || !categoryId) {
    return res
      .status(400)
      .json({ message: "Missing image, sessionId or categoryId" });
  }

  try {
    await connectDB();

    const budgetSession = await BudgetSession.findOne({ sessionId });
    if (!budgetSession) {
      return res
        .status(404)
        .json({ message: "Budgetsessionen hittades inte." });
    }

    const category = budgetSession.categories.find(
      (c: any) => c.id === categoryId,
    );
    if (!category) {
      return res.status(404).json({ message: "Kategorin hittades inte." });
    }

    const blobPath = `budget-category-images/${categoryId}-${Date.now()}.jpg`;
    const raw = await fs.promises.readFile(file.filepath);
    const buffer = await compressImage(raw);

    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType: "image/jpeg",
    });

    fs.promises.unlink(file.filepath).catch(() => {});

    if (category.imageUrl && String(category.imageUrl).startsWith("http")) {
      del(category.imageUrl).catch(() => {});
    }

    category.imageUrl = url;
    await budgetSession.save();

    return res.status(200).json({ imageUrl: url });
  } catch (err: any) {
    log.error("Budget category image upload failed", {
      sessionId,
      categoryId,
      error: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({
      message: `Uppladdning misslyckades: ${err?.message || "okänt fel"}`,
    });
  }
}
