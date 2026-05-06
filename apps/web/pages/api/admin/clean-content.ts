import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import { Comment, Proposal, CitizenProposal } from "@/lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("clean-content");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Du är ett modereringssystem för en svensk demokratisk diskussionsplattform.
Analysera inlägget och svara med ENBART ett JSON-objekt på EN rad, inget annat.

Format: {"status":"ok","reason":""}

Statusvärden:
- "ok"   → acceptabelt innehåll, även hetsiga politiska argument
- "flag" → något av följande: svordomar, grov obscenitet, sexuellt stötande innehåll, hat mot folkgrupp, uppmaning till brott, hot, annat lagbrott

Regler:
• reason ska bara fyllas i om status är "flag", annars tom sträng
• reason ska vara max 1 mening på svenska
• Sexuellt innehåll som är uppenbart olämpligt för ett demokratiskt forum ska flaggas
• Flagga INTE normala hetsiga politiska argument`;

async function checkContent(text: string): Promise<{ shouldRemove: boolean; reason: string }> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: SYSTEM,
      messages: [{ role: "user", content: `Inlägg:\n\n${text.trim().slice(0, 800)}` }],
    });
    const raw = ((response.content[0] as any).text ?? "").trim();
    const match = raw.match(/\{.*?\}/s);
    if (!match) return { shouldRemove: false, reason: "" };
    let parsed: { status?: string; reason?: string };
    try { parsed = JSON.parse(match[0]); } catch { return { shouldRemove: false, reason: "" }; }
    return { shouldRemove: parsed.status === "flag", reason: parsed.reason ?? "" };
  } catch {
    return { shouldRemove: false, reason: "" };
  }
}

async function runBatched<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = 5,
) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(fn));
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.isSuperAdmin) return res.status(403).json({ error: "Forbidden" });

  await connectDB();

  const [comments, proposals, citizenProposals] = await Promise.all([
    Comment.find({}).select("_id text").lean(),
    Proposal.find({}).select("_id title problem solution").lean(),
    CitizenProposal.find({}).select("_id title description").lean(),
  ]);

  type RemovedItem = { type: string; id: string; preview: string; reason: string };
  const removed: RemovedItem[] = [];

  await runBatched(comments as any[], async (c) => {
    const text = (c.text ?? "").trim();
    if (!text) return;
    const { shouldRemove, reason } = await checkContent(text);
    if (shouldRemove) {
      await Comment.deleteOne({ _id: c._id });
      removed.push({ type: "comment", id: c._id.toString(), preview: text.slice(0, 120), reason });
    }
  });

  await runBatched(proposals as any[], async (p) => {
    const text = [p.title, p.problem, p.solution].filter(Boolean).join(" ").trim();
    if (!text) return;
    const { shouldRemove, reason } = await checkContent(text);
    if (shouldRemove) {
      await Proposal.deleteOne({ _id: p._id });
      removed.push({ type: "proposal", id: p._id.toString(), preview: (p.title ?? "").slice(0, 120), reason });
    }
  });

  await runBatched(citizenProposals as any[], async (cp) => {
    const text = [cp.title, cp.description].filter(Boolean).join(" ").trim();
    if (!text) return;
    const { shouldRemove, reason } = await checkContent(text);
    if (shouldRemove) {
      await CitizenProposal.deleteOne({ _id: cp._id });
      removed.push({ type: "medborgarförslag", id: cp._id.toString(), preview: (cp.title ?? "").slice(0, 120), reason });
    }
  });

  const checked = comments.length + proposals.length + citizenProposals.length;
  log.info("Content clean complete", { checked, removed: removed.length });

  return res.status(200).json({ checked, removed: removed.length, items: removed });
}
