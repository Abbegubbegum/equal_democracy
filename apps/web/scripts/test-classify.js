/**
 * Quick local debug script for classifyCategories.
 * Run from apps/web/: node scripts/test-classify.js
 *
 * Shows the raw Anthropic response so you can see exactly what Claude
 * returns and whether the filter step is dropping it.
 */

require("dotenv").config({ path: ".env.local" });
const Anthropic = require("@anthropic-ai/sdk").default;

const ALL_CATEGORIES = [
  "Vallentuna centrum",
  "Bällsta",
  "Kårsta",
  "Össeby-Garn",
  "Frösunda",
  "Lindholmen",
  "Angarn",
  "Karby",
  "Skola & utbildning",
  "Trafik & infrastruktur",
  "Miljö & klimat",
  "Äldreomsorg",
  "Barn & familj",
  "Fritid & kultur",
  "Bostäder",
  "Trygghet & säkerhet",
  "Näringsliv & arbete",
  "Allmänt",
];

const client = new Anthropic();

async function debug(title, description) {
  console.log(`\n--- Testing: "${title}" ---`);

  const system = `You are a content classifier for a Swedish municipal democracy platform.
Your task is to classify citizen-submitted content (proposals, questions, debates) into the most relevant categories.

Available categories:
${ALL_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Rules:
- Return between 1 and 3 categories that best match the content.
- "Allmänt" is a catch-all for broad topics like taxes, democracy, or budget — only use it if no specific category fits.
- Prefer specific geographic or thematic categories over "Allmänt" when possible.
- Respond with ONLY a valid JSON array of category strings, nothing else.
- Example: ["Trafik & infrastruktur", "Vallentuna centrum"]`;

  const userMessage = description?.trim()
    ? `Title: ${title}\nDescription: ${description}`
    : `Title: ${title}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content[0].text?.trim();
  console.log("Raw response from Claude:", JSON.stringify(raw));

  // Strip markdown fences (the fix)
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let parsed;
  try {
    parsed = JSON.parse(text);
    console.log("Parsed:", parsed);
  } catch (e) {
    console.log("JSON.parse FAILED:", e.message);
    return;
  }

  if (!Array.isArray(parsed)) {
    console.log("Not an array — would return []");
    return;
  }

  const filtered = parsed.filter(
    (c) => typeof c === "string" && ALL_CATEGORIES.includes(c),
  );
  console.log("After ALL_CATEGORIES filter:", filtered);

  if (filtered.length === 0) {
    console.log("\n⚠ FILTER DROPPED EVERYTHING. Checking for near-misses:");
    for (const c of parsed) {
      const nearest = ALL_CATEGORIES.find(
        (a) => a.toLowerCase() === c.toLowerCase(),
      );
      if (nearest)
        console.log(`  "${c}" → case mismatch? closest: "${nearest}"`);
      else console.log(`  "${c}" → no match in ALL_CATEGORIES`);
    }
  }
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — check .env.local");
    process.exit(1);
  }
  console.log("ANTHROPIC_API_KEY present ✓");

  await debug(
    "Bygg fler cykelbanor i centrum",
    "Vi behöver säkrare cykelleder längs E18",
  );
  await debug(
    "Bättre skollunch för barn",
    "Maten i skolorna håller inte tillräcklig kvalitet",
  );
  await debug("Nytt äldreboende i Bällsta");
})();
