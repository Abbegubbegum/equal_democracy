#!/usr/bin/env node
/**
 * Fills the budget-post image library from a folder.
 *
 *   pnpm budget-images --dir <folder> [--production] [--apply]
 *
 * Each file is named after the budget post it illustrates — "Skatteintäkter.jpg",
 * "Kommunstyrelsen.png". Every file becomes the library image for that name
 * (BudgetPostImage + Vercel Blob under budget-post-images/) and is put on every
 * budget post with that name, in every budget session, past and future: a new
 * budget created later picks it up automatically. Runs the exact code the admin
 * upload uses — lib/budget/post-images.ts — so the two can't drift.
 *
 * Dry run unless --apply. --production targets MONGODB_URI_PRODUCTION; dev and
 * production share one Blob store, only the database differs.
 */

import { config as loadEnv } from "dotenv";
import { register } from "module";
import { fileURLToPath } from "url";
import { readFileSync, readdirSync } from "fs";
import { resolve, extname, basename } from "path";

loadEnv({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });
process.env.LOG_LEVEL = "error";
register(new URL("./ts-resolve-hooks.mjs", import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

const dir = arg("--dir");
const production = process.argv.includes("--production");
const apply = process.argv.includes("--apply");

if (!dir) {
  console.error(
    "Usage: pnpm budget-images --dir <folder> [--production] [--apply]",
  );
  process.exit(1);
}
if (production) {
  if (!process.env.MONGODB_URI_PRODUCTION) {
    console.error("MONGODB_URI_PRODUCTION is not set in apps/web/.env.local");
    process.exit(1);
  }
  // lib/mongodb.ts reads MONGODB_URI when it is first imported, below.
  process.env.MONGODB_URI = process.env.MONGODB_URI_PRODUCTION;
}
if (apply && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set in apps/web/.env.local");
  process.exit(1);
}

const { default: connectDB } = await import("../lib/mongodb.ts");
const { BudgetSession } = await import("../lib/models.ts");
const { postImageKey, setPostImage } =
  await import("../lib/budget/post-images.ts");
const mongoose = (await import("mongoose")).default;

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const files = readdirSync(dir).filter((f) =>
  IMAGE_EXT.has(extname(f).toLowerCase()),
);

await connectDB();
console.log(
  `${apply ? "APPLYING" : "DRY RUN"} — database "${mongoose.connection.name}", ${files.length} bilder\n`,
);

// Which budgets currently carry a post by each name — for the report only.
const sessions = await BudgetSession.find()
  .select("name status categories.name incomeCategories.name")
  .lean();
function budgetsWith(key) {
  return sessions
    .filter((s) =>
      [...(s.categories ?? []), ...(s.incomeCategories ?? [])].some(
        (p) => p.name && postImageKey(p.name) === key,
      ),
    )
    .map((s) => `${s.name}${s.status === "active" ? " (aktiv)" : ""}`);
}

for (const file of files) {
  const name = basename(file, extname(file));
  const matches = budgetsWith(postImageKey(name));
  const where = matches.length
    ? `→ ${matches.length} budget(ar): ${matches.join(", ")}`
    : "→ ingen nuvarande budget (sparas i biblioteket för framtida budgetar)";

  if (apply) {
    await setPostImage(name, readFileSync(resolve(dir, file)));
  }
  console.log(`  ✓  ${name}  ${where}`);
}

if (!apply) console.log("\nKör igen med --apply för att ladda upp.");
await mongoose.disconnect();
