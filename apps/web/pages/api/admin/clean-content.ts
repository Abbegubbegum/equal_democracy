import type { NextApiRequest, NextApiResponse } from "next";
import { moderateContent } from "@/lib/ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Comment, Proposal, CitizenProposal } from "@/lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("clean-content");

async function checkContent(
  text: string,
): Promise<{ shouldRemove: boolean; reason: string }> {
  try {
    const { status, message } = await moderateContent(text.slice(0, 800));
    return { shouldRemove: status === "flag", reason: message };
  } catch {
    return { shouldRemove: false, reason: "" };
  }
}

async function runBatched<T>(
  items: T[],
  fn: (_item: T) => Promise<void>,
  concurrency = 5,
) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.isSuperAdmin)
    return res.status(403).json({ error: "Forbidden" });

  await connectDB();

  const [comments, proposals, citizenProposals] = await Promise.all([
    Comment.find({}).select("_id text").lean(),
    Proposal.find({}).select("_id title problem solution").lean(),
    CitizenProposal.find({}).select("_id title description").lean(),
  ]);

  type RemovedItem = {
    type: string;
    id: string;
    preview: string;
    reason: string;
  };
  const removed: RemovedItem[] = [];

  await runBatched(comments as any[], async (c) => {
    const text = (c.text ?? "").trim();
    if (!text) return;
    const { shouldRemove, reason } = await checkContent(text);
    if (shouldRemove) {
      await Comment.deleteOne({ _id: c._id });
      removed.push({
        type: "comment",
        id: c._id.toString(),
        preview: text.slice(0, 120),
        reason,
      });
    }
  });

  await runBatched(proposals as any[], async (p) => {
    const text = [p.title, p.problem, p.solution]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!text) return;
    const { shouldRemove, reason } = await checkContent(text);
    if (shouldRemove) {
      await Proposal.deleteOne({ _id: p._id });
      removed.push({
        type: "proposal",
        id: p._id.toString(),
        preview: (p.title ?? "").slice(0, 120),
        reason,
      });
    }
  });

  await runBatched(citizenProposals as any[], async (cp) => {
    const text = [cp.title, cp.description].filter(Boolean).join(" ").trim();
    if (!text) return;
    const { shouldRemove, reason } = await checkContent(text);
    if (shouldRemove) {
      await CitizenProposal.deleteOne({ _id: cp._id });
      removed.push({
        type: "medborgarförslag",
        id: cp._id.toString(),
        preview: (cp.title ?? "").slice(0, 120),
        reason,
      });
    }
  });

  const checked = comments.length + proposals.length + citizenProposals.length;
  log.info("Content clean complete", { checked, removed: removed.length });

  return res
    .status(200)
    .json({ checked, removed: removed.length, items: removed });
}
