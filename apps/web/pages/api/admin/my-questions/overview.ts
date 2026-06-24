import type { NextApiRequest, NextApiResponse } from "next";
import { INTEREST_TO_CATEGORIES } from "@repo/types";
import { requireAdmin } from "@/lib/admin";
import connectDB from "@/lib/mongodb";
import { MunicipalSession, BudgetSession, CitizenProposal } from "@/lib/models";

/**
 * GET /api/admin/my-questions/overview?interest=<key>
 * Flattens municipal items, budget categories, and citizen proposals into one
 * list per content type, optionally filtered to the categories mapped by a
 * single interest area key — powers the admin "Mina frågor" overview.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  const session = await requireAdmin(req, res);
  if (!session) return;

  await connectDB();

  const interest = req.query.interest ? String(req.query.interest) : null;
  const targetCategories = interest ? INTEREST_TO_CATEGORIES[interest] : null;

  const matches = (categories: string[] | undefined) => {
    if (!targetCategories) return true;
    return (categories || []).some((c) => targetCategories.includes(c));
  };

  const [municipalSessions, budgetSessions, citizenProposals] =
    await Promise.all([
      MunicipalSession.find({})
        .select("name items")
        .sort({ meetingDate: -1 })
        .lean(),
      BudgetSession.find({}).select("sessionId name categories").lean(),
      CitizenProposal.find({})
        .select(
          "title description categories imageUrl averageRating ratingCount status createdAt",
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

  const municipalItems = municipalSessions.flatMap((s: any) =>
    (s.items || [])
      .filter((item: any) => matches(item.categories))
      .map((item: any) => ({
        id: String(item._id),
        municipalSessionId: String(s._id),
        sessionName: s.name,
        title: item.title,
        description: item.description,
        categories: item.categories || [],
        imageUrl: item.imageUrl || null,
        averageRating: item.averageRating || 0,
        ratingCount: item.ratingCount || 0,
        status: item.status,
      })),
  );

  const budgetCategories = budgetSessions.flatMap((s: any) =>
    (s.categories || [])
      .filter((c: any) => matches(c.tags))
      .map((c: any) => ({
        id: c.id,
        sessionId: s.sessionId,
        sessionName: s.name,
        name: c.name,
        tags: c.tags || [],
        imageUrl: c.imageUrl || null,
        averageRating: c.averageRating || 0,
        ratingCount: c.ratingCount || 0,
        defaultAmount: c.defaultAmount,
      })),
  );

  const filteredProposals = citizenProposals
    .filter((p: any) => matches(p.categories))
    .map((p: any) => ({
      id: String(p._id),
      title: p.title,
      description: p.description,
      categories: p.categories || [],
      imageUrl: p.imageUrl || null,
      averageRating: p.averageRating || 0,
      ratingCount: p.ratingCount || 0,
      status: p.status,
    }));

  return res.status(200).json({
    municipalItems,
    budgetCategories,
    citizenProposals: filteredProposals,
  });
}
