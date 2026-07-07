import Anthropic from "@anthropic-ai/sdk";
import { ALL_CATEGORIES, type ContentCategory } from "@repo/types";

// ── Singleton client ─────────────────────────────────────────────────────────
export const anthropic = new Anthropic();

// ── Model names ──────────────────────────────────────────────────────────────
export const AI_MODELS = {
  fast: "claude-haiku-4-5-20251001", // moderation, chat, classification
  smart: "claude-sonnet-4-6", // PDF extraction, complex analysis
} as const;

// ── Types ────────────────────────────────────────────────────────────────────
export type ModerationStatus = "ok" | "warn" | "flag";

export interface ModerationResult {
  status: ModerationStatus;
  message: string;
}

export interface ReviewResult {
  corrected: string | null; // spelling/grammar-fixed version, or null if clean
  concise: string | null; // shorter/clearer version, or null if already tight
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Single-turn chat. Returns the assistant's text reply.
 * Fails open: returns fallbackReply on any error.
 */
export async function chat(options: {
  system: string;
  message: string;
  maxTokens?: number;
  fallbackReply?: string;
}): Promise<string> {
  const { system, message, maxTokens = 300, fallbackReply = "" } = options;
  try {
    const response = await anthropic.messages.create({
      model: AI_MODELS.fast,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: message }],
    });
    return (response.content[0] as any).text ?? fallbackReply;
  } catch {
    return fallbackReply;
  }
}

/**
 * Classify text into 1–3 content categories from ALL_CATEGORIES.
 * Returns an empty array on any error (fail open — caller handles missing categories).
 */
export async function classifyCategories(options: {
  title: string;
  description?: string;
  maxResults?: number;
}): Promise<ContentCategory[]> {
  const { title, description, maxResults = 3 } = options;

  const system = `You are a content classifier for a Swedish municipal democracy platform.
Your task is to classify citizen-submitted content (proposals, questions, debates) into the most relevant categories.

Available categories:
${ALL_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Rules:
- Return between 1 and ${maxResults} categories that best match the content.
- "Allmänt" is a catch-all for broad topics like taxes, democracy, or budget — only use it if no specific category fits.
- Prefer specific geographic or thematic categories over "Allmänt" when possible.
- Respond with ONLY a valid JSON array of category strings, nothing else.
- Example: ["Trafik & infrastruktur", "Vallentuna centrum"]`;

  const userMessage = description?.trim()
    ? `Title: ${title}\nDescription: ${description}`
    : `Title: ${title}`;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 100,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = (response.content[0] as any).text?.trim() ?? "[]";
    // Claude sometimes wraps JSON in markdown code fences — strip them
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed: unknown = JSON.parse(text);

    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[])
      .filter(
        (c): c is ContentCategory =>
          typeof c === "string" &&
          (ALL_CATEGORIES as readonly string[]).includes(c),
      )
      .slice(0, maxResults);
  } catch {
    return [];
  }
}

/**
 * Moderate a piece of user-submitted text.
 * - "ok"   → publish normally
 * - "warn" → show the user a gentle warning, let them confirm
 * - "flag" → block or escalate
 *
 * Always fails open (returns "ok") so AI outages never block posting.
 */
export async function moderateContent(text: string): Promise<ModerationResult> {
  const system = `Du är ett modereringssystem för en svensk demokratisk diskussionsplattform.
Analysera inlägget och svara med ENBART ett JSON-objekt på EN rad, inget annat.

Format: {"status":"ok","message":""}

Statusvärden:
- "ok"   → acceptabelt, konstruktivt eller normalt politiskt argument (även om starkt)
- "warn" → repetitivt, tydligt off-topic, nonsens/obegriplig text (tangentbordsmadring, slumpmässiga tecken, "test", eller annan text utan faktiskt innehåll), personangrepp eller milt ohövligt — ge kort vänligt tips i message
- "flag" → svordomar, obscenitet, hat mot folkgrupp, uppmaning till brott, hot eller annat lagbrott — beskriv problemet i message

Regler:
• Lämna message som tom sträng om status är "ok"
• message ska vara max 2 meningar på svenska
• Flagga INTE normala hetsiga argument — bara faktiska överträdelser
• Om texten är nonsens eller uppenbarligen inte ett argument, fråga vänligt om det verkligen var menat som ett argument (t.ex. i stil med "Hej, är det här verkligen ett argument?")
• Vid tvekan, välj "warn" framför "flag"`;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 150,
      system,
      messages: [
        { role: "user", content: `Inlägg:\n\n${text.trim().slice(0, 1000)}` },
      ],
    });

    const raw = ((response.content[0] as any).text ?? "").trim();
    const match = raw.match(/\{.*?\}/s);
    if (!match) return { status: "ok", message: "" };

    let parsed: { status?: string; message?: string };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { status: "ok", message: "" };
    }

    const status = (
      ["ok", "warn", "flag"].includes(parsed.status ?? "")
        ? parsed.status
        : "ok"
    ) as ModerationStatus;

    return { status, message: parsed.message ?? "" };
  } catch {
    return { status: "ok", message: "" };
  }
}

/**
 * MAJ writing assistant: given a draft proposal or argument, suggest a
 * spelling/grammar-corrected version and a more concise version (each null if
 * nothing to improve). Never changes the content/opinion — only the wording.
 * Fails open (returns nulls) so AI outages never block posting.
 */
export async function reviewContent(options: {
  text: string;
  kind: "proposal" | "argument";
}): Promise<ReviewResult> {
  const { text, kind } = options;
  const label = kind === "proposal" ? "medborgarförslag" : "debattargument";

  const system = `Du är MAJ, en hjälpsam skrivassistent för en svensk kommunal demokratiplattform. En medborgare har skrivit ett ${label}. Din uppgift är att hjälpa dem skriva tydligare — INTE att censurera eller ändra åsikten.

Svara med ENBART ett JSON-objekt på en rad:
{"corrected": <sträng eller null>, "concise": <sträng eller null>}

- "corrected": om texten har stavfel, saknade versaler (t.ex. ortnamn/egennamn som "Vallentuna"), eller tydliga grammatikfel — ge en rättad version med EXAKT samma innehåll och ton. Annars null.
- "concise": om texten kan bli kortare och tydligare utan att tappa innehåll — ge en stramare version. Annars null.

Regler:
• Ändra ALDRIG innehållet, åsikten eller sakuppgifter — bara språket.
• Behåll svenska och medborgarens egen röst.
• Är texten redan korrekt och koncis: {"corrected": null, "concise": null}
• Inga förklaringar, bara JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: text.trim().slice(0, 1500) }],
    });

    const raw = ((response.content[0] as any).text ?? "").trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const match = cleaned.match(/\{.*\}/s);
    if (!match) return { corrected: null, concise: null };

    const parsed: { corrected?: unknown; concise?: unknown } = JSON.parse(
      match[0],
    );
    const orig = text.trim();
    const norm = (v: unknown) =>
      typeof v === "string" && v.trim() && v.trim() !== orig ? v.trim() : null;

    return { corrected: norm(parsed.corrected), concise: norm(parsed.concise) };
  } catch {
    return { corrected: null, concise: null };
  }
}
