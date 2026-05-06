import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { createLogger } from "@/lib/logger";

const log = createLogger("moderate");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Du är ett modereringssystem för en svensk demokratisk diskussionsplattform.
Analysera inlägget och svara med ENBART ett JSON-objekt på EN rad, inget annat.

Format: {"status":"ok","message":""}

Statusvärden:
- "ok"   → acceptabelt, konstruktivt eller normalt politiskt argument (även om starkt)
- "warn" → repetitivt, tydligt off-topic, personangrepp eller milt ohövligt — ge kort vänligt tips i message
- "flag" → svordomar, obscenitet, hat mot folkgrupp, uppmaning till brott, hot eller annat lagbrott — beskriv problemet i message

Regler:
• Lämna message som tom sträng om status är "ok"
• message ska vara max 2 meningar på svenska
• Flagga INTE normala hetsiga argument — bara faktiska överträdelser
• Vid tvekan, välj "warn" framför "flag"`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { text } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(200).json({ status: "ok", message: "" });
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: SYSTEM,
      messages: [{ role: "user", content: `Inlägg:\n\n${text.trim().slice(0, 1000)}` }],
    });

    const raw = ((response.content[0] as any).text ?? "").trim();
    const jsonMatch = raw.match(/\{.*?\}/s);
    if (!jsonMatch) return res.status(200).json({ status: "ok", message: "" });

    let parsed: { status?: string; message?: string };
    try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = {}; }

    const status = ["ok", "warn", "flag"].includes(parsed.status ?? "") ? parsed.status : "ok";
    return res.status(200).json({ status, message: parsed.message ?? "" });
  } catch (error) {
    log.error("Moderation check failed", { error: error.message });
    return res.status(200).json({ status: "ok", message: "" }); // fail open — don't block posting
  }
}
