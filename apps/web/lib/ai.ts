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

// How a draft proposal relates to an existing one MAJ flags as a likely duplicate.
export type DuplicateRelation =
  | "same" // same idea, just reworded
  | "more_specific" // a precisering of the existing proposal
  | "more_general"; // a deprecisering (broader version) of the existing one

export interface DuplicateMatch {
  id: string; // _id of the existing proposal
  relation: DuplicateRelation;
  reason: string; // one short Swedish sentence explaining the overlap
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  description: string;
}

export interface ArgumentCandidate {
  id: string;
  text: string;
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

/**
 * MAJ duplicate check: given a draft citizen proposal and the list of existing
 * active proposals, flag those that describe the same idea — whether reworded
 * ("gör en beach" vs "anlägg en badstrand"), a precisering (more specific), or
 * a deprecisering (more general). Conservative: only near-certain overlaps.
 * Fails open (returns []) so AI outages never block posting.
 */
export async function findDuplicates(options: {
  title: string;
  description: string;
  candidates: DuplicateCandidate[];
}): Promise<DuplicateMatch[]> {
  const { title, description, candidates } = options;
  if (!candidates.length) return [];

  // Reference candidates by index so Claude never has to echo long ObjectIds.
  const list = candidates
    .map((c, i) =>
      `[${i}] ${c.title}\n${c.description.trim().slice(0, 240)}`.trim(),
    )
    .join("\n\n");

  const system = `Du är MAJ, en assistent för en svensk kommunal demokratiplattform. En medborgare lämnar ett nytt medborgarförslag. Din uppgift är att avgöra om samma förslag redan finns bland de befintliga förslagen — så att medborgare röstar på ETT gemensamt förslag i stället för att splittra rösterna på dubletter.

En dublett kan vara:
- "same": samma förslag med andra ord (t.ex. "gör en beach" = "anlägg en badstrand")
- "more_specific": en precisering av ett befintligt förslag (samma idé, men snävare)
- "more_general": en mer allmän formulering (deprecisering) av ett befintligt förslag

Svara med ENBART en JSON-array, inget annat:
[{"index": <nummer>, "relation": "same"|"more_specific"|"more_general", "reason": "<kort mening på svenska>"}]

Regler:
• Ta bara med förslag som verkligen handlar om samma sak — vid minsta tvekan, utelämna det.
• Olika ämnen som råkar dela kategori är INTE dubletter.
• Returnera en tom array [] om inget befintligt förslag är en dublett.
• "reason": max en mening som förklarar överlappet.`;

  const userMessage = `NYTT FÖRSLAG:\n${title}\n${description.trim().slice(0, 500)}\n\nBEFINTLIGA FÖRSLAG:\n${list}`;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = ((response.content[0] as any).text ?? "").trim();
    return parseDuplicateMatches(
      raw,
      candidates.map((c) => c.id),
    );
  } catch {
    return [];
  }
}

/**
 * MAJ duplicate check for a debate argument: given a draft argument and the
 * existing arguments on the SAME question with the SAME stance, flag those that
 * make the same point — reworded, more specific, or more general. Point is to
 * steer people to rate an existing argument instead of reposting it, so the
 * finite set of real arguments doesn't drown in duplicates. Conservative; fails
 * open (returns []).
 */
export async function findDuplicateArguments(options: {
  text: string;
  candidates: ArgumentCandidate[];
}): Promise<DuplicateMatch[]> {
  const { text, candidates } = options;
  if (!candidates.length) return [];

  // Reference candidates by index so Claude never has to echo long ObjectIds.
  const list = candidates
    .map((c, i) => `[${i}] ${c.text.trim().slice(0, 240)}`)
    .join("\n\n");

  const system = `Du är MAJ, en assistent för en svensk kommunal demokratiplattform. En medborgare skriver ett nytt debattargument i en fråga. Alla argument nedan har SAMMA ställningstagande (för/emot/neutral) som det nya. Din uppgift är att avgöra om samma argument redan framförts — så att medborgare betygsätter ETT gemensamt argument i stället för att splittra rösterna på dubletter.

En dublett kan vara:
- "same": samma poäng med andra ord
- "more_specific": en precisering av ett befintligt argument (samma poäng, men snävare)
- "more_general": en mer allmän formulering (deprecisering) av ett befintligt argument

Svara med ENBART en JSON-array, inget annat:
[{"index": <nummer>, "relation": "same"|"more_specific"|"more_general", "reason": "<kort mening på svenska>"}]

Regler:
• Ta bara med argument som verkligen gör samma poäng — vid minsta tvekan, utelämna det.
• Två argument på samma sida men av OLIKA skäl är INTE dubletter.
• Returnera en tom array [] om inget befintligt argument är en dublett.
• "reason": max en mening som förklarar överlappet.`;

  const userMessage = `NYTT ARGUMENT:\n${text.trim().slice(0, 500)}\n\nBEFINTLIGA ARGUMENT (samma ställningstagande):\n${list}`;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODELS.fast,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const raw = ((response.content[0] as any).text ?? "").trim();
    return parseDuplicateMatches(
      raw,
      candidates.map((c) => c.id),
    );
  } catch {
    return [];
  }
}

/**
 * Parse Claude's `[{index, relation, reason}]` reply into DuplicateMatch[],
 * mapping each index back to the candidate id at that position. Shared by the
 * proposal and argument duplicate checks. Never throws.
 */
function parseDuplicateMatches(raw: string, ids: string[]): DuplicateMatch[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const match = cleaned.match(/\[.*\]/s);
  if (!match) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const relations: DuplicateRelation[] = [
    "same",
    "more_specific",
    "more_general",
  ];
  const seen = new Set<string>();
  const results: DuplicateMatch[] = [];

  for (const item of parsed as any[]) {
    const idx = Number(item?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= ids.length) continue;
    const relation = relations.includes(item?.relation)
      ? (item.relation as DuplicateRelation)
      : "same";
    const id = ids[idx];
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({
      id,
      relation,
      reason: typeof item?.reason === "string" ? item.reason.trim() : "",
    });
  }

  return results;
}
