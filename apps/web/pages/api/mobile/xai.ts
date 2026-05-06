import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { verifyBearerToken } from "../../../lib/mobile-jwt";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MobileXAI");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Du är XAI, en demokratisk assistent för Vallentuna Framåt — ett lokalt demokratiparti i Vallentuna kommun, Sverige.

Du hjälper medborgare att:
- Förstå pågående sessioner och omröstningar
- Formulera medborgarförslag och kommentarer
- Förstå partiets värderingar och hur appen fungerar
- Navigera i demokratiska processer

Partiets kärnvärden: Medborgardialog (invånare som delägare), Hållbar utveckling (socioteknik), Öppenhet och anonymitet (korruptionsskydd), XAI (förklarbar AI i politiken).

Du är kortfattad (max 3 meningar per svar), saklig och hjälpsam. Svara alltid på svenska. Du är transparent med att du är en AI-assistent, inte en människa. Om du är osäker, säg det öppet.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { message, context } = req.body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ message: "message is required" });
  }
  if (message.length > 500) {
    return res.status(400).json({ message: "message too long" });
  }

  try {
    const userContent = context
      ? `[Kontext: användaren är på fliken "${context}"]\n\n${message.trim()}`
      : message.trim();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const reply = (response.content[0] as any).text ?? "";
    return res.status(200).json({ reply });
  } catch (error) {
    log.error("XAI call failed", { error: error.message });
    return res.status(500).json({ message: "XAI är tillfälligt otillgänglig. Försök igen om en stund." });
  }
}
