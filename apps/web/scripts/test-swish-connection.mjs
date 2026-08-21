#!/usr/bin/env node
/**
 * Diagnostic: proves the Swish mTLS setup works, before any app code depends on it.
 *
 *   node scripts/test-swish-connection.mjs
 *
 * It deliberately re-implements the ~20 lines of transport rather than importing
 * lib/swish/client.ts, so that a failure here points squarely at the certificate
 * and env-var setup and cannot be caused by app code.
 *
 * The probe is a GET for a payment request that does not exist. Any HTTP status
 * at all means the TLS handshake succeeded and Swish accepted our certificate —
 * that is the thing being tested, not the 404.
 */

import { config } from "dotenv";
import crypto from "crypto";
import https from "https";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URLS = {
  mss: "https://mss.cpc.getswish.net/swish-cpcapi",
  production: "https://cpc.getswish.net/swish-cpcapi",
};

function decodePem(name, value) {
  if (!value) {
    console.error(`\n  ✗ ${name} is not set in apps/web/.env.local.`);
    console.error(`    Run: node scripts/swish-cert-to-env.mjs\n`);
    process.exit(1);
  }
  const trimmed = value.trim();
  const pem = trimmed.startsWith("-----BEGIN")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
  if (!pem.includes("-----BEGIN")) {
    console.error(`\n  ✗ ${name} does not decode to PEM text.\n`);
    process.exit(1);
  }
  return pem;
}

const env = process.env.SWISH_ENV || "mss";
const baseUrl = BASE_URLS[env];
if (!baseUrl) {
  console.error(
    `\n  ✗ SWISH_ENV must be "mss" or "production", got "${env}".\n`,
  );
  process.exit(1);
}

const cert = decodePem("SWISH_CERT_BASE64", process.env.SWISH_CERT_BASE64);
const key = decodePem("SWISH_KEY_BASE64", process.env.SWISH_KEY_BASE64);
const ca = process.env.SWISH_CA_BASE64
  ? decodePem("SWISH_CA_BASE64", process.env.SWISH_CA_BASE64)
  : undefined;

const leaf = new crypto.X509Certificate(cert);
const chainLength = (cert.match(/-----BEGIN CERTIFICATE-----/g) || []).length;

console.log(`\n  environment : ${env}  →  ${baseUrl}`);
console.log(`  payeeAlias  : ${process.env.SWISH_PAYEE_ALIAS || "(not set)"}`);
console.log(`  certificate : ${leaf.subject.replace(/\n/g, ", ")}`);
console.log(
  `  chain       : ${chainLength} certificate${chainLength === 1 ? "" : "s"}`,
);
console.log(
  `  pinned CA   : ${ca ? "yes (SWISH_CA_BASE64 set)" : "no — using Node's trust store"}`,
);

const cn = leaf.subject.match(/^CN=(.+)$/m)?.[1]?.trim();
if (
  cn &&
  process.env.SWISH_PAYEE_ALIAS &&
  cn !== process.env.SWISH_PAYEE_ALIAS
) {
  console.log(
    `\n  ⚠  SWISH_PAYEE_ALIAS (${process.env.SWISH_PAYEE_ALIAS}) differs from the certificate CN (${cn}).` +
      `\n     Swish answers 403 when the payeeAlias is not the certificate's Swish number.`,
  );
}

// With --id <instructionUUID> this fetches a real payment request, which is the
// quickest way to see what Swish actually stored. Without it, the probe asks for
// an id that cannot exist — a 404 still proves the handshake worked.
const explicitId = process.argv.includes("--id")
  ? process.argv[process.argv.indexOf("--id") + 1]
  : null;
const probeId =
  explicitId || crypto.randomUUID().replace(/-/g, "").toUpperCase();
const url = new URL(`${baseUrl}/api/v1/paymentrequests/${probeId}`);
const startedAt = Date.now();

console.log(`\n  → GET ${url.pathname}\n`);

const req = https.request(
  {
    method: "GET",
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    cert,
    key,
    ca,
    headers: { Accept: "application/json" },
  },
  (res) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
      const ms = Date.now() - startedAt;
      const body = Buffer.concat(chunks).toString("utf8").trim();

      console.log(`  ← HTTP ${res.statusCode} in ${ms}ms`);
      if (body) {
        try {
          console.log(
            body.trim().startsWith("{")
              ? JSON.stringify(JSON.parse(body), null, 2)
                  .split("\n")
                  .map((l) => `     ${l}`)
                  .join("\n")
              : `     ${body.slice(0, 300)}`,
          );
        } catch {
          console.log(`     ${body.slice(0, 300)}`);
        }
      }

      if (res.statusCode === 401) {
        console.log(
          `\n  ✗ 401 Unauthorized — TLS worked, but Swish did not accept the certificate,` +
            `\n    or the Swish number in it is not enrolled.\n`,
        );
        process.exit(1);
      }

      console.log(
        `\n  ✓ mTLS handshake succeeded and Swish accepted the client certificate.` +
          (explicitId
            ? "\n"
            : `\n    (${res.statusCode} for an unknown payment request is the expected answer.)\n`),
      );
    });
  },
);

req.setTimeout(15000, () => req.destroy(new Error("timed out after 15s")));

req.on("error", (err) => {
  console.error(`\n  ✗ ${err.message}  [${err.code || "no code"}]`);
  if (
    err.code === "EPROTO" ||
    err.code === "ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE"
  ) {
    console.error(
      `\n    The handshake was rejected. Most often this means SWISH_CERT_BASE64 holds only the\n` +
        `    leaf certificate — it must contain the full chain up to the Swish Root CA.`,
    );
  }
  if (
    err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    err.code === "SELF_SIGNED_CERT_IN_CHAIN"
  ) {
    console.error(
      `\n    Could not verify Swish's *server* certificate. If SWISH_CA_BASE64 is set, unset it —\n` +
        `    it replaces Node's trust store rather than extending it.`,
    );
  }
  console.error("");
  process.exit(1);
});

req.end();
