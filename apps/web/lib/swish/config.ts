import https from "https";

/**
 * Swish Commerce API configuration.
 *
 * Certificates are passed as base64-encoded env vars rather than files, so the
 * same code path works locally and on Vercel (read-only filesystem outside /tmp).
 * Everything is lazy + cached at module level: the TLS handshake is expensive and
 * we want one Agent per lambda instance, not one per request.
 */

export type SwishEnv = "mss" | "production";

const BASE_URLS: Record<SwishEnv, string> = {
  mss: "https://mss.cpc.getswish.net/swish-cpcapi",
  production: "https://cpc.getswish.net/swish-cpcapi",
};

export interface SwishConfig {
  env: SwishEnv;
  baseUrl: string;
  /** Our Swish number — must match the CN of the client certificate. */
  payeeAlias: string;
  /** Absolute HTTPS URL Swish posts payment results to. */
  callbackUrl: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Swish is configured via base64 env vars — run \`node scripts/swish-cert-to-env.mjs\` to generate them.`,
    );
  }
  return value;
}

/**
 * Accepts either raw PEM text or base64-encoded PEM, so pasting a certificate
 * straight into .env.local works as well as the base64 form the script emits.
 */
function decodePem(name: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("-----BEGIN")) return trimmed;

  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  if (!decoded.includes("-----BEGIN")) {
    throw new Error(
      `${name} does not contain a PEM block. Expected base64-encoded PEM (or raw PEM text), got ${trimmed.length} chars that decode to something else.`,
    );
  }
  return decoded;
}

let cachedConfig: SwishConfig | null = null;

export function getSwishConfig(): SwishConfig {
  if (cachedConfig) return cachedConfig;

  const env = (process.env.SWISH_ENV || "mss") as SwishEnv;
  if (env !== "mss" && env !== "production") {
    throw new Error(`SWISH_ENV must be "mss" or "production", got "${env}".`);
  }

  const callbackBase = required("SWISH_CALLBACK_BASE_URL").replace(/\/$/, "");
  if (!callbackBase.startsWith("https://")) {
    // Swish rejects the payment request with validation error RP03 otherwise.
    throw new Error(
      `SWISH_CALLBACK_BASE_URL must use HTTPS (Swish rejects non-HTTPS callbacks with RP03), got "${callbackBase}".`,
    );
  }

  cachedConfig = {
    env,
    baseUrl: BASE_URLS[env],
    payeeAlias: required("SWISH_PAYEE_ALIAS"),
    callbackUrl: `${callbackBase}/api/swish/callback`,
  };
  return cachedConfig;
}

let cachedAgent: https.Agent | null = null;

/**
 * The mTLS agent. Node's global `fetch` cannot attach a client certificate,
 * which is why the whole Swish client is built on node:https instead.
 */
export function getSwishAgent(): https.Agent {
  if (cachedAgent) return cachedAgent;

  const cert = decodePem("SWISH_CERT_BASE64", required("SWISH_CERT_BASE64"));
  const key = decodePem("SWISH_KEY_BASE64", required("SWISH_KEY_BASE64"));

  // Optional. Setting it *replaces* Node's trust store rather than extending it,
  // so leave it unset unless you deliberately want to pin the Swish server root.
  const caRaw = process.env.SWISH_CA_BASE64;
  const ca = caRaw ? decodePem("SWISH_CA_BASE64", caRaw) : undefined;

  cachedAgent = new https.Agent({
    cert,
    key,
    ca,
    keepAlive: true,
    // One idle socket is plenty; payment volume is low and lambdas are short-lived.
    maxSockets: 8,
  });
  return cachedAgent;
}

/** True when we are pointed at the simulator — no real money can move. */
export function isSandbox(): boolean {
  return getSwishConfig().env === "mss";
}
