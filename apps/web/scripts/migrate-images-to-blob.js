/**
 * One-shot migration: move existing local images under public/session-images/
 * and public/citizen-proposal-images/ to Vercel Blob, then rewrite the
 * corresponding `imageUrl` field on each document.
 *
 * Idempotent: any document whose imageUrl already starts with "http" is skipped.
 *
 * Usage:
 *   node scripts/migrate-images-to-blob.js [--dry-run] [--production]
 *
 * Reads MONGODB_URI (or MONGODB_URI_PRODUCTION with --production) and
 * BLOB_READ_WRITE_TOKEN from .env.local. To get the token locally, link the
 * project once and run `vercel env pull apps/web/.env.local`.
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { put } = require("@vercel/blob");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const USE_PRODUCTION = args.includes("--production");

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

const env = loadEnv();
const MONGODB_URI = USE_PRODUCTION
  ? env.MONGODB_URI_PRODUCTION
  : env.MONGODB_URI;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || env.BLOB_READ_WRITE_TOKEN;

if (!MONGODB_URI) {
  console.error(
    `Missing ${USE_PRODUCTION ? "MONGODB_URI_PRODUCTION" : "MONGODB_URI"} in .env.local`,
  );
  process.exit(1);
}
if (!BLOB_TOKEN && !DRY_RUN) {
  console.error(
    "Missing BLOB_READ_WRITE_TOKEN. Run `vercel env pull .env.local` after connecting the Blob store, or pass --dry-run.",
  );
  process.exit(1);
}

const PUBLIC_DIR = path.join(process.cwd(), "public");

async function migrateCollection({
  collectionName,
  pathPrefix,
  buildBlobKey,
}) {
  const collection = mongoose.connection.collection(collectionName);
  const docs = await collection
    .find({ imageUrl: { $regex: `^${pathPrefix}` } })
    .toArray();

  console.log(`\n[${collectionName}] ${docs.length} docs to migrate`);

  let migrated = 0;
  let missing = 0;
  let failed = 0;

  for (const doc of docs) {
    const relativePath = doc.imageUrl;
    const absPath = path.join(PUBLIC_DIR, relativePath);

    if (!fs.existsSync(absPath)) {
      console.warn(`  MISSING file for ${doc._id}: ${relativePath}`);
      missing++;
      continue;
    }

    const ext = path.extname(absPath) || ".jpg";
    const blobKey = buildBlobKey(doc, ext);
    const contentType = inferContentType(ext);

    if (DRY_RUN) {
      console.log(`  [dry-run] ${doc._id}  ->  ${blobKey}`);
      migrated++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(absPath);
      const { url } = await put(blobKey, buffer, {
        access: "public",
        contentType,
        token: BLOB_TOKEN,
      });
      await collection.updateOne(
        { _id: doc._id },
        { $set: { imageUrl: url } },
      );
      console.log(`  OK  ${doc._id}  ->  ${url}`);
      migrated++;
    } catch (err) {
      console.error(`  FAIL  ${doc._id}: ${err.message}`);
      failed++;
    }
  }

  return { total: docs.length, migrated, missing, failed };
}

function inferContentType(ext) {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  if (e === ".heic") return "image/heic";
  return "image/jpeg";
}

async function main() {
  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Migrating images to Vercel Blob (${USE_PRODUCTION ? "PRODUCTION" : "dev"} database)`,
  );
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const sessionResult = await migrateCollection({
    collectionName: "sessions",
    pathPrefix: "/session-images/",
    buildBlobKey: (doc, ext) =>
      `session-images/${doc._id}-${Date.now()}${ext}`,
  });

  const proposalResult = await migrateCollection({
    collectionName: "citizenproposals",
    pathPrefix: "/citizen-proposal-images/",
    buildBlobKey: (doc, ext) => `citizen-proposal-images/${doc._id}${ext}`,
  });

  console.log("\n=== Summary ===");
  console.log("sessions:          ", sessionResult);
  console.log("citizenproposals:  ", proposalResult);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
