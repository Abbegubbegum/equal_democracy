#!/usr/bin/env node
/**
 * Turns the Swish certificate files in apps/web/certs/ into the base64 env vars
 * the app reads at runtime (lib/swish/config.ts).
 *
 *   node scripts/swish-cert-to-env.mjs                 # auto-detect files in ./certs
 *   node scripts/swish-cert-to-env.mjs --cert x.pem --key x.key
 *   node scripts/swish-cert-to-env.mjs --env production   # override detection
 *
 * Paste the output into apps/web/.env.local, or into Vercel's env var settings
 * (scope the MSS cert to Development/Preview and the real one to Production).
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CERTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "certs",
);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i]?.startsWith("--")) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function autoDetect() {
  if (!fs.existsSync(CERTS_DIR)) {
    fail(
      `No certs directory at ${CERTS_DIR}. Create it and drop your Swish certificate files in.`,
    );
  }
  const files = fs.readdirSync(CERTS_DIR);

  // The client chain is a .pem holding one or more certificates; the Swish TLS
  // root (DigiCert) is a separate single-certificate file we must not confuse it with.
  const cert = files.find((f) => f.endsWith(".pem") && !/rootca|tls/i.test(f));
  const key = files.find((f) => f.endsWith(".key"));

  if (!cert) fail(`No client certificate .pem found in ${CERTS_DIR}.`);
  if (!key) fail(`No private key .key found in ${CERTS_DIR}.`);

  return { cert: path.join(CERTS_DIR, cert), key: path.join(CERTS_DIR, key) };
}

function read(label, file) {
  if (!fs.existsSync(file)) fail(`${label} not found: ${file}`);
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("-----BEGIN")) fail(`${label} is not PEM text: ${file}`);
  return text;
}

const args = parseArgs(process.argv.slice(2));
const paths =
  args.cert && args.key ? { cert: args.cert, key: args.key } : autoDetect();

const certPem = read("Certificate", paths.cert);
const keyPem = read("Private key", paths.key);

const certCount = (certPem.match(/-----BEGIN CERTIFICATE-----/g) || []).length;

// The leaf is the first certificate in the chain; its CN is the merchant's Swish
// number, which is exactly what payeeAlias has to be.
let leaf;
try {
  leaf = new crypto.X509Certificate(certPem);
} catch (err) {
  fail(`Could not parse the certificate: ${err.message}`);
}
const leafCn = leaf.subject.match(/^CN=(.+)$/m)?.[1]?.trim();

console.log(
  `\n  cert  : ${path.basename(paths.cert)}  (${certCount} certificate${certCount === 1 ? "" : "s"} in chain)`,
);
console.log(`  key   : ${path.basename(paths.key)}`);
console.log(`  leaf  : ${leaf.subject.replace(/\n/g, ", ")}`);
console.log(`  valid : ${leaf.validFrom} → ${leaf.validTo}`);

if (new Date(leaf.validTo) < new Date()) {
  console.log(
    "\n  ⚠  This certificate has EXPIRED. Swish will reject the handshake with no explanatory error.",
  );
}

if (certCount === 1) {
  console.log(
    "\n  ⚠  Only one certificate in the chain. Swish requires the leaf *plus* all\n" +
      "     intermediate CA certificates up to the Swish Root CA, or the TLS\n" +
      "     handshake fails with no explanatory error.",
  );
}

let keyObject;
try {
  keyObject = crypto.createPrivateKey(keyPem);
} catch (err) {
  fail(
    `Could not read the private key (${err.message}).\n` +
      `  If it is encrypted, decrypt it first: openssl pkey -in ${path.basename(paths.key)} -out decrypted.key`,
  );
}

if (!leaf.checkPrivateKey(keyObject)) {
  fail(
    "The private key does not match the certificate. These files are not a pair.",
  );
}
console.log("  match : private key matches the certificate ✓");

// Which environment this certificate belongs to. Swish's test chain roots at
// "Swish Root CA v2 Test", the production one at "Swish Root CA v2". Getting
// this wrong is a nasty footgun: a production certificate presented to MSS (or
// the reverse) fails the TLS handshake with no explanatory error.
const chainPems =
  certPem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  ) || [];
let detectedEnv = "production";
for (const pem of chainPems) {
  try {
    const c = new crypto.X509Certificate(pem);
    if (/\bTest\b/i.test(c.issuer) || /\bTest\b/i.test(c.subject))
      detectedEnv = "mss";
  } catch {
    /* an unparseable block is not fatal — the leaf already parsed above */
  }
}
const env = args.env || detectedEnv;
console.log(
  `  env   : ${env}${args.env ? " (from --env)" : " (detected from the certificate chain)"}`,
);

console.log("\n  ── paste into apps/web/.env.local ──\n");
console.log(`SWISH_ENV=${env}`);
if (leafCn) console.log(`SWISH_PAYEE_ALIAS=${leafCn}`);
console.log(`SWISH_CALLBACK_BASE_URL=https://www.vallentuna.app`);
console.log(`SWISH_CERT_BASE64=${Buffer.from(certPem).toString("base64")}`);
console.log(`SWISH_KEY_BASE64=${Buffer.from(keyPem).toString("base64")}`);
console.log("");
