import type { NextApiRequest, NextApiResponse } from "next";
import { chat } from "../../../lib/ai";
import { requireAccount } from "../../../lib/viewer";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MobileXAI");

const SYSTEM_PROMPT = `Du är MAJ, en demokratisk assistent för Vallentuna Framåt — ett lokalt demokratiparti i Vallentuna kommun, Sverige.

Du hjälper medborgare att:
- Förstå pågående sessioner och omröstningar
- Formulera medborgarförslag och kommentarer
- Förstå partiets värderingar och hur appen fungerar
- Navigera i demokratiska processer

Partiets kärnvärden: Medborgardialog (invånare som delägare), Hållbar utveckling (socioteknik), Öppenhet och anonymitet (korruptionsskydd), XAI (förklarbar AI i politiken).

Du är kortfattad (max 3 meningar per svar), saklig och hjälpsam. Svara alltid på svenska. Du är transparent med att du är en AI-assistent, inte en människa. Om du är osäker, säg det öppet.`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  // requireAccount, not requireParticipant: MAJ is a conversation, not an
  // action on the platform, so someone who may not vote here may still ask it
  // things. It stays behind the login only because every call is
  // Anthropic-billed and this is a public URL (docs/bankid-login-plan.md D4).
  const viewer = await requireAccount(req, res);
  if (!viewer) return;

  const { message, context } = req.body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ message: "message is required" });
  }
  if (message.length > 500) {
    return res.status(400).json({ message: "message too long" });
  }

  const started = Date.now();
  log.info("XAI request", {
    context: context ?? null,
    messageLength: message.length,
    messagePreview: message.slice(0, 120),
    hasKey: !!process.env.ANTHROPIC_API_KEY,
  });

  try {
    const userContent = context
      ? `[Kontext: användaren är på fliken "${context}"]\n\n${message.trim()}`
      : message.trim();

    const reply = await chat({
      system: SYSTEM_PROMPT,
      message: userContent,
      maxTokens: 300,
      fallbackReply: "",
    });
    if (!reply) {
      log.warn("XAI returned empty reply", {
        durationMs: Date.now() - started,
      });
      throw new Error("empty reply");
    }
    log.info("XAI reply", {
      durationMs: Date.now() - started,
      replyLength: reply.length,
      replyPreview: reply.slice(0, 200),
    });
    return res.status(200).json({ reply });
  } catch (error) {
    log.error("XAI call failed", {
      error: error.message,
      stack: error.stack,
      durationMs: Date.now() - started,
    });
    return res.status(500).json({
      message: "MAJ är tillfälligt otillgänglig. Försök igen om en stund.",
    });
  }
}
