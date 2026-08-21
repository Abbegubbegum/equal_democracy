import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Payment } from "@/lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminPayments");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/admin/payments?status=PAID&env=production&limit=50&skip=0
 *
 * Payment ledger for reconciliation and counting members. Super-admin only:
 * this joins payer identities to amounts, which is more than a regular admin
 * needs to run sessions.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.isSuperAdmin)
    return res.status(403).json({ message: "Forbidden" });

  try {
    await connectDB();

    const { status, env } = req.query;
    const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const filter: Record<string, unknown> = {};
    if (typeof status === "string" && status) filter.status = status;
    if (typeof env === "string" && env) filter.env = env;

    const [rows, total, byStatus] = await Promise.all([
      Payment.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            amount: 1,
            currency: 1,
            status: 1,
            env: 1,
            errorCode: 1,
            membershipYears: 1,
            paymentReference: 1,
            payerAlias: 1,
            datePaid: 1,
            createdAt: 1,
            userName: "$user.name",
            userEmail: "$user.email",
          },
        },
      ]),
      Payment.countDocuments(filter),
      // Totals ignore skip/limit — they describe the whole filtered set.
      Payment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const paid = byStatus.find((s: any) => s._id === "PAID");

    return res.status(200).json({
      payments: rows,
      total,
      byStatus: byStatus.map((s: any) => ({
        status: s._id,
        count: s.count,
        amount: s.amount,
      })),
      paidCount: paid?.count ?? 0,
      paidAmount: paid?.amount ?? 0,
    });
  } catch (err: any) {
    log.error("Failed to list payments", { error: err?.message });
    return res.status(500).json({ message: "Kunde inte hämta betalningar." });
  }
}
