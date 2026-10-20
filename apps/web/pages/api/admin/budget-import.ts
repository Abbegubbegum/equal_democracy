import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { csrfProtection } from "@/lib/csrf";
import { isSuperAdmin } from "@/lib/admin-helper";
import { createLogger } from "@/lib/logger";
import {
  applyBudgetImport,
  BudgetSpecError,
  planBudgetImport,
} from "@/lib/budget/budget-spec";

const log = createLogger("AdminBudgetImport");

// A budget file with four party alternatives is a few kB; the PDF path sends
// the AI's reading of the PDF, which is no bigger.
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

/**
 * POST /api/admin/budget-import — superadmin only.
 * Body: { spec: BudgetSpec, apply?: boolean }
 *
 * Without `apply`: the preview (posts, spans, locked posts, each proposal's
 * balance, warnings) — nothing is written. With `apply: true`: saves exactly
 * that. Both admin creation paths (budget file, PDF via AI) end here, as does
 * `pnpm budget-import`, through lib/budget/budget-spec.ts.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });
  if (!csrfProtection(req, res)) return;

  const session = await getServerSession(req, res, authOptions);
  if (!isSuperAdmin(session?.user)) {
    return res.status(403).json({ message: "Superadmin access required" });
  }

  const { spec, apply } = req.body ?? {};
  try {
    await connectDB();
    if (apply) {
      const preview = await applyBudgetImport(spec, session.user.id);
      log.info("Budget imported", {
        sessionId: preview.sessionId,
        outcome: preview.outcome,
        by: session.user.id,
      });
      return res.status(200).json({ preview, saved: true });
    }
    const { preview } = await planBudgetImport(spec);
    return res.status(200).json({ preview, saved: false });
  } catch (error: any) {
    if (error instanceof BudgetSpecError) {
      return res.status(400).json({ message: error.message });
    }
    log.error("Budget import failed", { error: error.message });
    return res.status(500).json({ message: "Importen misslyckades." });
  }
}
