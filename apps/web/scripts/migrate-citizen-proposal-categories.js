/**
 * One-shot migration: convert CitizenProposal.categories from the old
 * numeric system (1-7) to the new string ALL_CATEGORIES taxonomy.
 *
 * Old taxonomy (CATEGORY_NAMES):
 *   1 → "Bygga, bo och miljö"
 *   2 → "Fritid och kultur"
 *   3 → "Förskola och skola"
 *   4 → "Ändring av styrdokument"
 *   5 → "Näringsliv och arbete"
 *   6 → "Omsorg och hjälp"
 *   7 → "Övrigt kommun och politik"
 *
 * Mapping is best-effort (the two taxonomies don't overlap exactly):
 *   1 → "Miljö & klimat"      (environment + housing, skewing env)
 *   2 → "Fritid & kultur"     (near-identical)
 *   3 → "Skola & utbildning"  (closest match)
 *   4 → "Allmänt"             (policy/governance — no specific match)
 *   5 → "Näringsliv & arbete" (near-identical)
 *   6 → "Allmänt"             (care is split across Äldreomsorg/Barn — use catch-all)
 *   7 → "Allmänt"             (misc politics — use catch-all)
 *
 * Idempotent: only updates documents whose categories array contains numbers
 * (or numeric strings). String categories are left untouched.
 *
 * Usage (from apps/web/):
 *   node scripts/migrate-citizen-proposal-categories.js [--production] [--dry-run]
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const USE_PRODUCTION = args.includes("--production");
const DRY_RUN = args.includes("--dry-run");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`Could not find ${envPath}. Run this from apps/web/.`);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const NUMERIC_TO_STRING = {
  1: "Miljö & klimat",
  2: "Fritid & kultur",
  3: "Skola & utbildning",
  4: "Allmänt",
  5: "Näringsliv & arbete",
  6: "Allmänt",
  7: "Allmänt",
};

function migrateCategories(cats) {
  const result = [];
  for (const cat of cats) {
    const n = typeof cat === "string" ? parseInt(cat, 10) : cat;
    if (!isNaN(n) && NUMERIC_TO_STRING[n]) {
      const mapped = NUMERIC_TO_STRING[n];
      if (!result.includes(mapped)) result.push(mapped);
    } else if (typeof cat === "string" && isNaN(parseInt(cat, 10))) {
      // Already a string category name — keep as-is
      if (!result.includes(cat)) result.push(cat);
    }
  }
  return result;
}

(async () => {
  const env = loadEnv();
  const uri = USE_PRODUCTION ? env.MONGODB_URI_PRODUCTION : env.MONGODB_URI;
  if (!uri) {
    console.error(
      `Missing ${USE_PRODUCTION ? "MONGODB_URI_PRODUCTION" : "MONGODB_URI"} in .env.local`,
    );
    process.exit(1);
  }

  console.log(
    `Connecting to ${USE_PRODUCTION ? "PRODUCTION" : "development"} database${DRY_RUN ? " [DRY RUN]" : ""}...`,
  );
  await mongoose.connect(uri);

  const col = mongoose.connection.collection("citizenproposals");
  const all = await col.find({}).toArray();

  let total = 0,
    updated = 0,
    skipped = 0;
  for (const doc of all) {
    total++;
    const cats = doc.categories || [];
    const hasNumeric = cats.some(
      (c) => typeof c === "number" || !isNaN(parseInt(String(c), 10)),
    );

    if (!hasNumeric) {
      skipped++;
      continue;
    }

    const newCats = migrateCategories(cats);
    console.log(
      `  [${doc._id}] "${doc.title?.slice(0, 40)}" : ${JSON.stringify(cats)} → ${JSON.stringify(newCats)}`,
    );

    if (!DRY_RUN) {
      await col.updateOne({ _id: doc._id }, { $set: { categories: newCats } });
    }
    updated++;
  }

  await mongoose.disconnect();

  console.log(
    `\nDone. Total: ${total}, Updated: ${updated}, Skipped (already strings): ${skipped}${DRY_RUN ? " [DRY RUN — no changes written]" : ""}`,
  );
})();
