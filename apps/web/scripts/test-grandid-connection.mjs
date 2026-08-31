#!/usr/bin/env node
/**
 * Diagnostic for the Svensk E-identitet (GrandID) BankID + SPAR integration.
 *
 *   node scripts/test-grandid-connection.mjs                 # sign + SPAR — the voting flow
 *   node scripts/test-grandid-connection.mjs --auth          # identify + SPAR — the login flow
 *   node scripts/test-grandid-connection.mjs --show-pnr --verbose
 *   node scripts/test-grandid-connection.mjs --service-key 7c8c   # a different service
 *   node scripts/test-grandid-connection.mjs --probe --csv certs/e-identitet.csv
 *
 * `--auth` is what qualifies GRANDID_AUTH_SERVICE_KEY for BankID login
 * (docs/bankid-login-plan.md, stage 0). It answers the two questions no amount
 * of reading can: does the authentication service return `funcId:
 * Identification`, and does it return the SPAR block? Eligibility-at-login rests
 * entirely on the second.
 *
 * Unlike scripts/test-swish-connection.mjs, this deliberately imports the real
 * lib/bankid modules instead of re-implementing the transport. Swish's risk was
 * the mTLS handshake, so isolating it from app code was the point. Here there
 * are no certificates and the transport is unremarkable; the risky part is
 * parsing GetSession's four undiscriminated response shapes. Testing anything
 * other than the real parser would prove the wrong thing.
 *
 * Needs Node >= 22.6 for TypeScript imports (native and unflagged from 22.18 /
 * 23.6 onward; the package.json script passes --experimental-strip-types so
 * older 22.x still works).
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { register } from "module";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};

const PROBE = has("--probe");
/**
 * Which of our two services to exercise. Not cosmetic: it selects a different
 * service key, and the service key is what decides whether BankID signs or
 * identifies — see `GrandIdService` in lib/bankid/config.ts.
 */
const SERVICE = has("--auth") ? "auth" : "sign";
const SHOW_PNR = has("--show-pnr");
const VERBOSE = has("--verbose");

// Resolved against this file, not the cwd, so the script runs from anywhere.
loadEnv({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });

// The library logs every request as structured JSON. Useful when debugging,
// noise otherwise — and it must be set before the logger module is evaluated,
// which is why the imports below are dynamic.
if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = VERBOSE ? "debug" : "warn";

// lib/bankid is written for the bundler's extensionless imports; Node's ESM
// resolver is stricter. Must run before the first import of that code.
register(new URL("./ts-resolve-hooks.mjs", import.meta.url));

/**
 * Keeps the last raw GetSession body.
 *
 * `getBankIdSession` deliberately returns only the fields the app needs, which
 * makes it a bad instrument for answering "is there anything else in this
 * response?" — a blind spot that once led to a wrong conclusion about SPAR
 * being absent. Cloned so the library still reads the body normally.
 */
let lastRawSession = null;
const upstreamFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const response = await upstreamFetch(url, init);
  if (String(url).includes("GetSession")) {
    response
      .clone()
      .text()
      .then((text) => {
        lastRawSession = text;
      })
      .catch(() => {});
  }
  return response;
};

const { baseUrlFor } = await import("../lib/bankid/config.ts");
const { GrandIdApiError } = await import("../lib/bankid/client.ts");
const {
  startBankIdSession,
  getBankIdSession,
  cancelBankIdSession,
  MIN_POLL_INTERVAL_MS,
} = await import("../lib/bankid/session.ts");

const ENVIRONMENTS = ["test", "production"];

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const fail = (s) => `\x1b[31m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;

const mask = (secret) =>
  !secret ? "(not set)" : `${secret.slice(0, 4)}…${secret.slice(-4)}`;

/** Personal numbers stay out of terminal scrollback unless explicitly asked for. */
const maskPnr = (pnr) => (SHOW_PNR ? pnr : `${pnr.slice(0, 8)}****`);

function describeError(error) {
  if (error instanceof GrandIdApiError)
    return `${error.code} — ${error.message}`;
  return error.message;
}

const VISIBLE_TEXT = {
  sign: "Testverifiering av BankID för Vallentuna Framåt.\n\nIngen röst registreras.",
  // Displayed but not signed — an identification order agrees to nothing. Sent
  // anyway so the BankID app names who is asking, as it will in the real flow.
  auth: "Testinloggning till Vallentuna Framåt.",
};

/** What each service must produce for the transaction to mean what we asked for. */
const EXPECTED_FUNC_ID = { sign: "Signing", auth: "Identification" };

/**
 * The credentials file lists several service keys under the same name with no
 * indication of which environment or capability each has.
 */
function readCredentialsCsv(path) {
  const rows = readFileSync(resolve(path), "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));

  const [header, ...body] = rows;
  const col = (name) =>
    header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const apiKeyCol = col("Key");
  const serviceKeyCol = col("Service Key");
  const nameCol = col("NamnAPI");

  if (apiKeyCol === -1 || serviceKeyCol === -1) {
    throw new Error(
      `${path} needs "Key" and "Service Key" columns; found: ${header.join(", ")}`,
    );
  }

  return body.map((row, i) => ({
    label: (nameCol !== -1 && row[nameCol]) || `row ${i + 1}`,
    apiKey: row[apiKeyCol],
    serviceKey: row[serviceKeyCol],
  }));
}

/**
 * The configured service, unless --service-key overrode it. The argument takes
 * either a full key or a trailing fragment of one, matched against the
 * credentials file — enough to tell two 32-character hex strings apart without
 * pasting either.
 */
function resolveConfig() {
  const env = process.env.GRANDID_ENV || "test";
  const keyVar =
    SERVICE === "auth"
      ? "GRANDID_AUTH_SERVICE_KEY"
      : "GRANDID_SIGN_SERVICE_KEY";
  const config = {
    env,
    service: SERVICE,
    baseUrl: baseUrlFor(env),
    apiKey: process.env.GRANDID_API_KEY,
    serviceKey: process.env[keyVar],
  };

  if (!config.serviceKey && !valueOf("--service-key")) {
    console.error(
      fail(`\n  ✗ ${keyVar} is not set.`) +
        dim(
          SERVICE === "auth"
            ? "\n    This is the authentication service used for BankID login. Run\n" +
                "    `--probe --csv certs/e-identitet.csv` to find which key it is, or pass\n" +
                "    `--service-key <fragment>` to try one without setting it.\n"
            : "\n    This is the signing service used for votes.\n",
        ),
    );
    process.exit(1);
  }

  const override = valueOf("--service-key");
  if (!override) return config;

  if (override.length >= 32) {
    config.serviceKey = override;
    return config;
  }

  const csvPath = valueOf("--csv") || "certs/e-identitet.csv";
  const match = readCredentialsCsv(csvPath).find((candidate) =>
    candidate.serviceKey.endsWith(override),
  );
  if (!match) {
    console.error(
      fail(`\n  ✗ No service key in ${csvPath} ends with "${override}".\n`),
    );
    process.exit(1);
  }
  config.serviceKey = match.serviceKey;
  config.apiKey = match.apiKey || config.apiKey;
  return config;
}

// ---------------------------------------------------------------------------
// Probe: are these credentials valid, and where?
// ---------------------------------------------------------------------------

async function probe() {
  const csvPath = valueOf("--csv");
  let candidates;

  if (csvPath) {
    candidates = readCredentialsCsv(csvPath);
  } else {
    const apiKey = process.env.GRANDID_API_KEY;
    const serviceKey = process.env.GRANDID_SIGN_SERVICE_KEY;
    if (!apiKey || !serviceKey) {
      console.error(
        fail(
          "\n  ✗ No --csv given and GRANDID_API_KEY / GRANDID_SIGN_SERVICE_KEY are not set.\n",
        ),
      );
      process.exit(1);
    }
    candidates = [{ label: "from .env.local", apiKey, serviceKey }];
  }

  console.log(`\n  ${bold("Probing GrandID credentials")}`);
  console.log(
    dim(
      "  Each accepted combination starts a real BankID order, cancelled immediately.\n" +
        "  Acceptance only means the request was taken — whether BankID actually signs\n" +
        "  is visible in the completed signature's funcId, which needs a full run.\n",
    ),
  );

  const working = [];

  for (const candidate of candidates) {
    console.log(`  ${bold(candidate.label)}`);
    console.log(
      dim(
        `    apiKey ${mask(candidate.apiKey)}   serviceKey ${mask(candidate.serviceKey)}`,
      ),
    );

    for (const env of ENVIRONMENTS) {
      const config = {
        env,
        // Probing asks only whether a key is accepted at all, so it uses the
        // signing shape (which requires userVisibleData) as the stricter test.
        // Which capability a working key actually has is what a full --auth or
        // default run reports, from the completed signature's funcId.
        service: "sign",
        baseUrl: baseUrlFor(env),
        apiKey: candidate.apiKey,
        serviceKey: candidate.serviceKey,
      };

      try {
        const started = await startBankIdSession({
          config,
          service: "sign",
          visibleText: "Anslutningstest — Vallentuna Framåt",
        });
        console.log(`    ${ok("✓")} ${env.padEnd(10)} accepted`);
        working.push({ ...candidate, env });
        await cancelBankIdSession(started.sessionId, {
          config,
          service: SERVICE,
        });
      } catch (error) {
        console.log(
          `    ${fail("✗")} ${env.padEnd(10)} ${dim(describeError(error))}`,
        );
      }
    }
    console.log("");
  }

  if (!working.length) {
    console.log(
      fail("  Nothing was accepted. The API key itself is likely wrong.\n"),
    );
    process.exit(1);
  }

  console.log(`  ${bold("Set these in apps/web/.env.local:")}\n`);
  for (const match of working) {
    console.log(dim(`    # ${match.label} — ${match.env}`));
    console.log(`    GRANDID_ENV=${match.env}`);
    console.log(`    GRANDID_API_KEY=${match.apiKey}`);
    console.log(`    GRANDID_SIGN_SERVICE_KEY=${match.serviceKey}\n`);
  }
  console.log(
    dim(
      "  Acceptance does not say which capability a key has, and the two are not\n" +
        "  interchangeable. Confirm each with a full run before trusting it:\n" +
        "    GRANDID_SIGN_SERVICE_KEY       → default run, must report funcId Signing\n" +
        "    GRANDID_AUTH_SERVICE_KEY  → --auth run, must report Identification + SPAR\n",
    ),
  );
}

// ---------------------------------------------------------------------------
// Full flow: sign, then report what SPAR sent back
// ---------------------------------------------------------------------------

/**
 * Pulls the eligibility-relevant fields out of the SPARv2 block. Stage 2 turns
 * this into lib/bankid/eligibility.ts properly; here it only has to show enough
 * to confirm the data arrived and is shaped as expected.
 */
function summariseSpar(userAttributes) {
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  const spar = userAttributes.SPARv2;
  if (!spar) return null;

  const registration = first(spar.ns14Folkbokforing) || {};
  const details = first(spar.ns10Persondetaljer) || {};
  const id = first(spar.ns4PersonId) || {};
  return {
    lanKod: registration.ns14FolkbokfordLanKod,
    kommunKod: registration.ns14FolkbokfordKommunKod,
    hemvist: registration.ns14Hemvist,
    birthDate: details.ns10Fodelsedatum,
    idType: id.ns4Typ,
    secrecy: spar.ns5Sekretessmarkering,
    protectedRegistration: spar.ns5SkyddadFolkbokforing,
    deceased: details.ns9Avlidendatum,
    deregistered: details.ns9AvregistreringsorsakKod,
  };
}

async function fullFlow() {
  const config = resolveConfig();
  console.log(`\n  ${bold("GrandID connection test")}`);
  console.log(`  environment : ${config.env}  →  ${config.baseUrl}`);
  console.log(`  apiKey      : ${mask(config.apiKey)}`);
  console.log(
    `  serviceKey  : ${mask(config.serviceKey)}` +
      (valueOf("--service-key") ? dim("  (overridden)") : ""),
  );
  console.log(
    `  service     : ${SERVICE}  →  expecting funcId ${EXPECTED_FUNC_ID[SERVICE]}`,
  );
  console.log(
    `  flow        : ${SERVICE === "auth" ? "identify" : "sign"} via GrandID's hosted UI`,
  );

  const started = await startBankIdSession({
    config,
    service: SERVICE,
    visibleText: VISIBLE_TEXT[SERVICE],
    hiddenData: JSON.stringify({
      purpose: "connection-test",
      service: SERVICE,
      at: new Date().toISOString(),
    }),
  });

  console.log(`\n  ${ok("✓")} order created — session ${started.sessionId}\n`);
  console.log(`  ${bold("Open this and complete BankID:")}\n`);
  console.log(`    ${bold(started.redirectUrl)}\n`);

  // Leaving an order dangling blocks the user's next attempt for a few minutes.
  let settled = false;
  process.on("SIGINT", async () => {
    if (!settled) {
      console.log(dim("\n  cancelling the BankID order…"));
      await cancelBankIdSession(started.sessionId, {
        config,
        service: SERVICE,
      });
    }
    process.exit(130);
  });

  const deadline = Date.now() + 5 * 60 * 1000;
  let announced = false;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, MIN_POLL_INTERVAL_MS));
    const session = await getBankIdSession(started.sessionId, {
      config,
      service: SERVICE,
    });

    // NOTLOGGEDIN is simply "not finished on the hosted page yet", and the user
    // needs time to open a browser and reach for a phone.
    if (session.state === "pending" || session.state === "unknown") {
      if (!announced) {
        announced = true;
        console.log(dim("  waiting for the hosted login to complete…"));
      }
      continue;
    }

    if (session.state === "failed") {
      settled = true;
      console.log(fail(`\n  ✗ BankID reported: ${session.hintCode}\n`));
      process.exit(1);
    }

    settled = true;
    report(session);
    return;
  }

  settled = true;
  console.log(fail("\n  ✗ Gave up after 5 minutes.\n"));
  await cancelBankIdSession(started.sessionId, { config, service: SERVICE });
  process.exit(1);
}

function report(session) {
  const expected = EXPECTED_FUNC_ID[SERVICE];
  console.log(
    `\n  ${ok(SERVICE === "auth" ? "✓ identification complete" : "✓ signing complete")}\n`,
  );
  console.log(`  personalNumber : ${maskPnr(session.personalNumber)}`);
  console.log(`  name           : ${session.name || "(not returned)"}`);

  // What BankID actually ran, read from the signed XML. It follows from the
  // service key, not from anything we sent: either service accepts
  // userVisibleData and returns success. This is the only place that
  // distinction is visible.
  const orderType = session.evidence.orderType;
  console.log(
    `  funcId         : ${orderType || "(unreadable)"}` +
      (orderType === expected
        ? ` ${ok("✓")}`
        : fail(`  ✗ expected ${expected}`)),
  );
  if (orderType && orderType !== expected) {
    console.log(
      SERVICE === "sign"
        ? fail("\n  ⚠  This is an authentication service, not a signing one.") +
            dim(
              "\n     BankID identified the user but signed nothing, so nothing binds them\n" +
                "     to the ballot text — and the API reported no error at all. The service\n" +
                "     key decides this; point GRANDID_SIGN_SERVICE_KEY at the signing service.",
            )
        : fail("\n  ⚠  This is a signing service, not an authentication one.") +
            dim(
              "\n     Logging in must not make anyone sign a document — they are agreeing\n" +
                "     to nothing. Point GRANDID_AUTH_SERVICE_KEY at the authentication\n" +
                "     service; the signing key belongs to GRANDID_SIGN_SERVICE_KEY.",
            ),
    );
  }

  let rawSession = null;
  try {
    rawSession = lastRawSession ? JSON.parse(lastRawSession) : null;
  } catch {
    rawSession = null;
  }

  const spar = summariseSpar(session.userAttributes);
  console.log(`\n  ${bold("SPAR")}`);
  if (!spar) {
    const mentions = lastRawSession
      ? (lastRawSession.match(/spar/gi) || []).length
      : 0;
    console.log(
      fail("  ✗ No SPARv2 block.") +
        dim(
          `\n    "spar" appears ${mentions} time(s) anywhere in the raw response.\n` +
            `    Keys present: ${Object.keys(session.userAttributes).join(", ")}\n`,
        ),
    );
  } else {
    for (const [key, value] of Object.entries(spar)) {
      if (value === undefined) continue;
      console.log(`  ${key.padEnd(21)}: ${value}`);
    }
    const inVallentuna = spar.lanKod === "01" && spar.kommunKod === "15";
    console.log(
      `\n  Vallentuna (0115): ${inVallentuna ? ok("yes") : fail("no")}`,
    );
  }

  // The point of the --auth run. Eligibility-at-login (docs/bankid-login-plan.md
  // §9) is only possible if the authentication service carries SPAR too — a
  // successful identification without it would mean login can verify who someone
  // is but not whether they may vote here.
  if (SERVICE === "auth") {
    const usable = spar && session.evidence.orderType === "Identification";
    console.log(
      `\n  ${bold("Verdict for BankID login")}: ` +
        (usable
          ? ok("this key can carry login and eligibility together")
          : fail("not usable as GRANDID_AUTH_SERVICE_KEY")),
    );
    if (!spar) {
      console.log(
        dim(
          "    Without SPAR, login could authenticate but not decide eligibility, and\n" +
            "    the capability model would have nothing to set. Ask Svensk e-identitet to\n" +
            "    attach the SPAR add-on to this service before building on it.",
        ),
      );
    }
  }

  // The whole response is saved, not just userAttributes — a fixture narrowed to
  // the field we already believe in cannot disprove that belief later.
  const fixturePath = join(tmpdir(), "grandid-getsession.json");
  const dump = rawSession
    ? JSON.parse(JSON.stringify(rawSession))
    : {
        userAttributes: JSON.parse(JSON.stringify(session.userAttributes)),
      };
  const target = dump.userAttributes || dump;
  if (!SHOW_PNR && target.personalNumber) {
    target.personalNumber = maskPnr(String(target.personalNumber));
  }
  if (!SHOW_PNR && dump.username) {
    dump.username = maskPnr(String(dump.username));
  }
  writeFileSync(fixturePath, JSON.stringify(dump, null, 2));
  console.log(`\n  Full GetSession response written to ${bold(fixturePath)}`);
  console.log(
    dim(
      "  Use it as the fixture for lib/bankid/eligibility.ts in stage 2." +
        (SHOW_PNR
          ? "  It holds a real personal number — do not commit it."
          : ""),
    ) + "\n",
  );
}

try {
  await (PROBE ? probe() : fullFlow());
} catch (error) {
  console.error(fail(`\n  ✗ ${describeError(error)}\n`));
  if (VERBOSE) console.error(error);
  process.exit(1);
}
