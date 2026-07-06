import mongoose from "mongoose";

export interface RatingAggregate {
  averageRating: number;
  ratingCount: number;
}

/**
 * Computes { averageRating, ratingCount } per target id from a ratings
 * collection, at read time — replaces the old denormalized counters that
 * used to be stored (and could drift) on the rated document itself.
 */
export async function getRatingAggregates(
  RatingModel: mongoose.Model<any>,
  foreignKey: string,
  // Accepts whatever shape `_id` comes back as from a .lean() query
  // (string, ObjectId, or unknown depending on how the source model is typed).
  ids: unknown[],
): Promise<Map<string, RatingAggregate>> {
  const map = new Map<string, RatingAggregate>();
  if (ids.length === 0) return map;

  const objectIds = ids.map((id) =>
    typeof id === "string" ? new mongoose.Types.ObjectId(id) : id,
  ) as mongoose.Types.ObjectId[];

  const results = await RatingModel.aggregate([
    { $match: { [foreignKey]: { $in: objectIds } } },
    {
      $group: {
        _id: `$${foreignKey}`,
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  for (const r of results) {
    map.set(r._id.toString(), {
      averageRating: Math.round(r.averageRating * 10) / 10,
      ratingCount: r.ratingCount,
    });
  }

  return map;
}
