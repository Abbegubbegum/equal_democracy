#!/usr/bin/env node
/**
 * Creates (or updates) a budget process from a budget file.
 *
 *   pnpm budget-import --file data/budgets/vallentuna-2027.json [--production] [--apply]
 *
 * The command-line twin of "Från budgetfil" in admin
 * (/admin/my-questions/budget): both run lib/budget/budget-spec.ts, so the
 * preview printed here is the one admin shows. The file holds the governing
 * coalition's figures (the slider defaults) and the parties' own proposals
 * (the coloured markers), in mnkr and by post name.
 *
 * A new budget is created as a draft (activate it in admin). An existing draft
 * is replaced; an active or closed budget only gets its parties' proposals
 * updated. Dry run unless --apply; --production targets MONGODB_URI_PRODUCTION.
 */

import { config as loadEnv } from "dotenv";
import { register } from "module";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { resolve } from "path";

loadEnv({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });
process.env.LOG_LEVEL = "error";
register(new URL("./ts-resolve-hooks.mjs", import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

const file = arg("--file");
const production = process.argv.includes("--production");
const apply = process.argv.includes("--apply");

if (!file) {
  console.error(
    "Usage: pnpm budget-import --file <data.json> [--production] [--apply]",
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

const { default: connectDB } = await import("../lib/mongodb.ts");
const { planBudgetImport, applyBudgetImport } =
  await import("../lib/budget/budget-spec.ts");
const mongoose = (await import("mongoose")).default;

const spec = JSON.parse(readFileSync(resolve(file), "utf8"));
await connectDB();

const fmt = (kr) =>
  `${(kr / 1_000_000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} mnkr`;
const OUTCOME = {
  create: "Skapas som utkast",
  "replace-draft": "Ersätter utkastet",
  "update-alternatives":
    "Finns redan och är aktiv/avslutad — bara partiernas förslag uppdateras",
};

try {
  const preview = apply
    ? await applyBudgetImport(spec)
    : (await planBudgetImport(spec)).preview;

  console.log(
    `${apply ? "SPARAT" : "DRY RUN"} — database "${mongoose.connection.name}", "${preview.name}" (${preview.sessionId})`,
  );
  console.log(`  ${OUTCOME[preview.outcome]}\n`);
  const c = preview.coalition;
  console.log(
    `  Förslaget: utgifter ${fmt(c.expenses)}, intäkter ${fmt(c.income)}, balans ${fmt(c.balance)}`,
  );
  for (const a of preview.alternatives) {
    console.log(
      `  ${a.key.padEnd(3)} ${a.label.padEnd(20)} skattesats ${a.taxRateKr ?? "–"} kr, balans ${fmt(a.balance)} (${a.posts} poster med siffra)`,
    );
  }
  for (const w of preview.warnings) console.log(`\n  ⚠ ${w}`);
  if (!apply) console.log("\nKör igen med --apply för att spara.");
  else if (preview.outcome !== "update-alternatives")
    console.log("\nAktivera budgeten i admin (/admin/my-questions/budget).");
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
}
await mongoose.disconnect();
