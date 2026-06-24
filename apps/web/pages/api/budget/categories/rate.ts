import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import connectDB from "../../../../lib/mongodb";
import { BudgetSession, BudgetCategoryRating } from "../../../../lib/models";
import { csrfProtection } from "../../../../lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("BudgetCategoryRate");

/**
 * GET/POST /api/budget/categories/rate
 * Rate a budget category with 1-5 stars
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
      const { sessionId, categoryId } = req.query;
      if (!sessionId || !categoryId) {
        return res
          .status(400)
          .json({ message: "sessionId and categoryId required" });
      }

      const rating = await BudgetCategoryRating.findOne({
        sessionId,
        categoryId,
        userId: session.user.id,
      });

      return res.status(200).json({
        userRating: rating ? rating.rating : null,
      });
    } catch (error) {
      log.error("Failed to fetch rating", {
        categoryId: req.query.categoryId,
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
      const { sessionId, categoryId, rating } = req.body;

      if (!sessionId || !categoryId || !rating) {
        return res.status(400).json({
          message: "sessionId, categoryId and rating are required",
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          message: "Rating must be between 1 and 5",
        });
      }

      const budgetSession = await BudgetSession.findOne({ sessionId });
      if (!budgetSession) {
        return res.status(404).json({ message: "Budget session not found" });
      }

      const category = budgetSession.categories.find(
        (c) => c.id === categoryId,
      );
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      let existingRating = await BudgetCategoryRating.findOne({
        sessionId,
        categoryId,
        userId: session.user.id,
      });

      if (existingRating) {
        existingRating.rating = rating;
        await existingRating.save();
      } else {
        existingRating = new BudgetCategoryRating({
          sessionId,
          categoryId,
          userId: session.user.id,
          rating,
        });
        await existingRating.save();
      }

      const allRatings = await BudgetCategoryRating.find({
        sessionId,
        categoryId,
      });
      const totalStars = allRatings.reduce((sum, r) => sum + r.rating, 0);
      const ratingCount = allRatings.length;
      const averageRating = ratingCount > 0 ? totalStars / ratingCount : 0;

      category.totalStars = totalStars;
      category.ratingCount = ratingCount;
      category.averageRating = averageRating;

      await budgetSession.save();

      log.info("Budget category rated", {
        userId: session.user.id,
        sessionId,
        categoryId,
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
      log.error("Failed to rate budget category", {
        categoryId: req.body.categoryId,
        error: error.message,
      });
      return res.status(500).json({ message: "Failed to rate category" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
