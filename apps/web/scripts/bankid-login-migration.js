#!/usr/bin/env node
/**
 * One-shot migration for BankID login (docs/bankid-login-plan.md §10).
 *
 *   node scripts/bankid-login-migration.js                        # dry run, dev DB
 *   node scripts/bankid-login-migration.js --apply
 *   node scripts/bankid-login-migration.js --production --apply
 *
 * Dry-run by default and idempotent, matching scripts/restructure-db.js.
 *
 * The one step that cannot be skipped is dropping `email_1`. Mongoose only ever
 * *adds* indexes — declaring the new partial index in models.ts does not replace
 * the old unique one, and the old one applies to missing values too. Leave it in
 * place and the first BankID account saves fine while the second fails with a
 * duplicate-key error on an email neither of them has. That failure appears at
 * signup, in production, to a real person, and reads like a bug in the login
 * code rather than a leftover index.
 */

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
});

const APPLY = process.argv.includes("--apply");
const PRODUCTION = process.argv.includes("--production");

const uri = PRODUCTION
  ? process.env.MONGODB_URI_PRODUCTION
  : process.env.MONGODB_URI;

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;
const good = (s) => `\x1b[32m${s}\x1b[0m`;

/** Prefixed so a dry run can never be mistaken for a completed one. */
const tag = () => (APPLY ? good("APPLIED ") : dim("would   "));

async function main() {
  if (!uri) {
    console.error(
      `\n  ✗ ${PRODUCTION ? "MONGODB_URI_PRODUCTION" : "MONGODB_URI"} is not set.\n`,
    );
    process.exit(1);
  }

  console.log(`\n  ${bold("BankID login migration")}`);
  console.log(
    `  database : ${PRODUCTION ? warn("PRODUCTION") : "development"}`,
  );
  console.log(`  mode     : ${APPLY ? warn("APPLY (writes)") : "dry run"}\n`);

  await mongoose.connect(uri);
  const users = mongoose.connection.collection("users");

  // ── 1. Drop the old unique index on email ────────────────────────────────
  const indexes = await users.indexes();
  const legacy = indexes.find(
    (index) =>
      index.key &&
      index.key.email === 1 &&
      index.unique &&
      !index.partialFilterExpression,
  );

  if (legacy) {
    console.log(
      `  ${tag()}drop index ${bold(legacy.name)} ${dim("(unique on email, applies to missing values)")}`,
    );
    if (APPLY) await users.dropIndex(legacy.name);
  } else {
    console.log(`  ${dim("skip    ")}no legacy unique email index present`);
  }

  // ── 2. Create the replacements ───────────────────────────────────────────
  const partial = indexes.find(
    (index) =>
      index.key && index.key.email === 1 && index.partialFilterExpression,
  );
  if (!partial) {
    console.log(
      `  ${tag()}create partial unique index on email ${dim("(only where a string exists)")}`,
    );
    if (APPLY) {
      await users.createIndex(
        { email: 1 },
        {
          unique: true,
          partialFilterExpression: { email: { $type: "string" } },
          name: "email_partial_unique",
        },
      );
    }
  } else {
    console.log(`  ${dim("skip    ")}partial email index already present`);
  }

  // Mongoose may already have created a *sparse* one from an earlier revision of
  // the schema. That index is wrong in a way that only shows up on the second
  // account without BankID: sparse skips missing fields, not explicit nulls, and
  // every such account carries `bankidSubject: null`.
  const staleSubject = indexes.find(
    (index) =>
      index.key && index.key.bankidSubject && !index.partialFilterExpression,
  );
  if (staleSubject) {
    console.log(
      `  ${tag()}drop index ${bold(staleSubject.name)} ${dim("(sparse unique — collides on explicit nulls)")}`,
    );
    if (APPLY) await users.dropIndex(staleSubject.name);
  }

  const subject = indexes.find(
    (index) =>
      index.key && index.key.bankidSubject && index.partialFilterExpression,
  );
  if (!subject) {
    console.log(
      `  ${tag()}create partial unique index on bankidSubject ${dim("(one person, one account)")}`,
    );
    if (APPLY) {
      await users.createIndex(
        { bankidSubject: 1 },
        {
          unique: true,
          partialFilterExpression: { bankidSubject: { $type: "string" } },
          name: "bankidSubject_partial_unique",
        },
      );
    }
  } else {
    console.log(
      `  ${dim("skip    ")}bankidSubject partial index already present`,
    );
  }

  // ── 3. Backfill the new fields ───────────────────────────────────────────
  //
  // Every existing account was created by email OTP, so `authMethod: "email"`
  // is the truth about all of them. Their address carries over untouched — it
  // is contact information now rather than a credential.
  const pending = await users.countDocuments({
    authMethod: { $exists: false },
  });
  console.log(
    `\n  ${tag()}backfill ${bold(String(pending))} account(s) ` +
      dim("→ authMethod:'email', bankidSubject:null, eligibility:unknown"),
  );
  if (APPLY && pending) {
    await users.updateMany({ authMethod: { $exists: false } }, [
      {
        $set: {
          authMethod: "email",
          bankidSubject: null,
          bankidLinkedAt: null,
          eligibility: { eligible: false, code: null, checkedAt: null },
        },
      },
    ]);
  }

  // ── 4. Who becomes unreachable when email login goes away ────────────────
  //
  // Not a migration step — a number worth knowing before Stage 7 step 4. These
  // users have no push token and no phone, so the only way to tell them to link
  // BankID is the address that is about to stop being a way in.
  const total = await users.countDocuments({});
  const emailOnly = await users.countDocuments({
    bankidSubject: null,
    $and: [
      { $or: [{ expoPushToken: null }, { expoPushToken: { $exists: false } }] },
      { $or: [{ phoneNumber: null }, { phoneNumber: { $exists: false } }] },
    ],
  });
  const members = await users.countDocuments({
    bankidSubject: null,
    membershipStatus: "active",
  });

  console.log(`\n  ${bold("Reachability before email login is switched off")}`);
  console.log(`    accounts total                    : ${total}`);
  console.log(
    `    reachable only by email           : ${emailOnly === 0 ? good("0") : warn(String(emailOnly))}`,
  );
  console.log(
    `    paying members without BankID yet : ${members === 0 ? good("0") : warn(String(members))} ` +
      dim("(these lose a paid membership if they end up orphaned)"),
  );

  if (!APPLY) {
    console.log(
      dim("\n  Dry run — nothing was written. Re-run with --apply.\n"),
    );
  } else {
    console.log(good("\n  Done.\n"));
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`\n  ✗ ${error.message}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
