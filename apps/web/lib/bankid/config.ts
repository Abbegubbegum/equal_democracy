/**
 * Svensk E-identitet (GrandID / eID API) configuration.
 *
 * There are no certificates here. Unlike Swish, GrandID authenticates every
 * call with two ordinary form fields — `apiKey` (identifies us as a customer)
 * and `authenticateServiceKey` (identifies which configured service to run) —
 * over plain HTTPS. So this module is env parsing and nothing else; the real
 * work is in ./session.ts.
 *
 * Kept to erasable-syntax-only TypeScript (no enums, no parameter properties)
 * so `scripts/test-grandid-connection.mjs` can import it directly under Node's
 * native type stripping.
 */

export type GrandIdEnv = "test" | "production";

/**
 * The **client** service — the server-to-server API (`/json1.1/FederatedLogin`,
 * `/GetSession`, `/Logout`). Not to be confused with the *login* service
 * (`login.grandid.com`), which is GrandID's hosted end-user UI: we pass
 * `gui=false` and drive the flow ourselves, so we never send anyone there.
 *
 * The docs list four deployments — EU (`grandid.com`) and SE (`e-identitet.se`),
 * each with test and production. They are separate installations with separate
 * customer provisioning, not aliases. Measured 2026-08-24 with our credentials:
 *
 *   client.grandid.com          ✓ accepted
 *   client-test.grandid.com     ✗ APIKEYNOTVALID01
 *   client.test.grandid.com     ✗ APIKEYNOTVALID01   (the docs spell the EU test
 *                                                     host both ways; both exist,
 *                                                     neither takes our keys)
 *   client.e-identitet.se       ✗ APIKEYNOTVALID01
 *   client.test.e-identitet.se  ✗ APIKEYNOTVALID01
 *
 * So our account lives on EU production only. Switching to the SE hosts would
 * need Svensk E-identitet to provision us there, and buys no data residency
 * anyway: client.grandid.com resolves into AWS eu-north-1 (Stockholm), the same
 * region as this app's `arn1` functions and the Atlas cluster.
 *
 * `test` is kept pointing at the EU test host so the constant stays meaningful
 * if we are ever given test credentials — see the plan's §8, we have none today.
 */
const BASE_URLS: Record<GrandIdEnv, string> = {
  test: "https://client-test.grandid.com",
  production: "https://client.grandid.com",
};

export interface GrandIdConfig {
  env: GrandIdEnv;
  baseUrl: string;
  apiKey: string;
  serviceKey: string;
}

export function baseUrlFor(env: GrandIdEnv): string {
  const url = BASE_URLS[env];
  if (!url) {
    throw new Error(
      `GRANDID_ENV must be "test" or "production", got "${env}".`,
    );
  }
  return url;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. GrandID needs GRANDID_ENV, GRANDID_API_KEY and ` +
        `GRANDID_SERVICE_KEY — run \`node scripts/test-grandid-connection.mjs --probe\` ` +
        `to work out which service key belongs to which environment.`,
    );
  }
  return value;
}

let cached: GrandIdConfig | null = null;

export function getGrandIdConfig(): GrandIdConfig {
  if (cached) return cached;

  const env = (process.env.GRANDID_ENV || "test") as GrandIdEnv;
  cached = {
    env,
    baseUrl: baseUrlFor(env),
    apiKey: required("GRANDID_API_KEY"),
    serviceKey: required("GRANDID_SERVICE_KEY"),
  };
  return cached;
}

/** True when this runtime can produce real, legally meaningful verifications. */
export function isProduction(): boolean {
  return getGrandIdConfig().env === "production";
}

/**
 * A safe-to-log identifier for a service key. We hold more than one and they
 * are indistinguishable by name, so logs need to say *which* was used without
 * ever printing the key itself.
 */
export function serviceFingerprint(config: GrandIdConfig): string {
  return `${config.env}:…${config.serviceKey.slice(-4)}`;
}
