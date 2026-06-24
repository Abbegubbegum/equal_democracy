import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import connectDB from "../../../../lib/mongodb";
import { MunicipalSession, MunicipalItemRating } from "../../../../lib/models";
import { csrfProtection } from "../../../../lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("MunicipalItemRate");

/**
 * GET/POST /api/municipal/items/rate
 * Rate a municipal session item with 1-5 stars
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await connectDB();

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: "You must be logged in" });
  }

  if (req.method === "GET") {
    try {
      const { itemId } = req.query;
      if (!itemId) {
        return res.status(400).json({ message: "Item ID required" });
      }

      const rating = await MunicipalItemRating.findOne({
        itemId,
        userId: session.user.id,
      });

      return res.status(200).json({
        userRating: rating ? rating.rating : null,
      });
    } catch (error) {
      log.error("Failed to fetch rating", {
        itemId: req.query.itemId,
        error: error.message,
      });
      return res.status(500).json({ message: "Failed to fetch rating" });
    }
  }

  if (req.method === "POST") {
    if (!csrfProtection(req, res)) {
      return;
    }

    try {
      const { municipalSessionId, itemId, rating } = req.body;

      if (!municipalSessionId || !itemId || !rating) {
        return res.status(400).json({
          message: "municipalSessionId, itemId and rating are required",
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          message: "Rating must be between 1 and 5",
        });
      }

      const municipalSession =
        await MunicipalSession.findById(municipalSessionId);
      if (!municipalSession) {
        return res.status(404).json({ message: "Session not found" });
      }

      const item = municipalSession.items.find(
        (it) => String(it._id) === String(itemId),
      );
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      let existingRating = await MunicipalItemRating.findOne({
        itemId,
        userId: session.user.id,
      });

      if (existingRating) {
        existingRating.rating = rating;
        await existingRating.save();
      } else {
        existingRating = new MunicipalItemRating({
          municipalSessionId,
          itemId,
          userId: session.user.id,
          rating,
        });
        await existingRating.save();
      }

      const allRatings = await MunicipalItemRating.find({ itemId });
      const totalStars = allRatings.reduce((sum, r) => sum + r.rating, 0);
      const ratingCount = allRatings.length;
      const averageRating = ratingCount > 0 ? totalStars / ratingCount : 0;

      item.totalStars = totalStars;
      item.ratingCount = ratingCount;
      item.averageRating = averageRating;

      await municipalSession.save();

      log.info("Municipal item rated", {
        userId: session.user.id,
        itemId,
        newRating: rating,
        totalStars,
      });

      return res.status(200).json({
        totalStars,
        ratingCount,
        averageRating,
        userRating: rating,
      });
    } catch (error) {
      log.error("Failed to rate municipal item", {
        itemId: req.body.itemId,
        error: error.message,
      });
      return res.status(500).json({ message: "Failed to rate item" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
