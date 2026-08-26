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

/**
 * Which GrandID host to call. Not the same thing as which runtime is calling —
 * see `runtimeEnv()`. In practice this is `production` everywhere: the test host
 * rejects our credentials (§8 of the integration plan), so there is no sandbox.
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
 * Which runtime a verification was created by — **not** which GrandID host it
 * used.
 *
 * These are deliberately separate. `GRANDID_ENV` selects the endpoint and stays
 * `production` everywhere, because the test host rejects our credentials and
 * there is no sandbox to move to. Stamping that on a row would therefore label
 * every verification "production" including ones started from a laptop, which is
 * exactly the distinction worth keeping.
 *
 * It matters most for `pnpm dev:web:live`, which points a development server at
 * the production database: rows it creates land in production data and are
 * identifiable only by this. `settleVerification` refuses to settle a row whose
 * runtime is not the current one, so a development verification can never be
 * completed by the deployment.
 */
export type VerificationRuntime = "development" | "production";

export function runtimeEnv(): VerificationRuntime {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

/**
 * Development-only override that skips the Vallentuna residency check.
 *
 * It exists because the residency check cannot otherwise be passed by whoever is
 * working on this: there is no GrandID sandbox and no synthetic identities, so
 * the only way to reach the eligible branch is to actually be folkbokförd in
 * Vallentuna. Without this the happy path is untestable for everyone else.
 *
 * Enabled in production, it would let anyone in Sweden vote in Vallentuna's
 * election. Three independent conditions therefore have to hold, and only one of
 * them is a setting:
 *
 * 1. `NODE_ENV !== "production"`. Vercel builds with NODE_ENV=production
 *    always, so no deployment can turn this on however its env vars are set.
 *    This is the load-bearing one — it is not configurable.
 * 2. `BANKID_ALLOW_ANY_KOMMUN=true`, explicitly.
 * 3. The database is not the production one. `pnpm dev:web:live` deliberately
 *    points a *development* server at the production database, which would
 *    otherwise satisfy (1) while writing real votes.
 *
 * Deliberately absent from `turbo.json`'s `env[]`: it cannot affect a build,
 * and listing it there would imply it belongs in Vercel. It does not.
 */
export function allowAnyKommun(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.BANKID_ALLOW_ANY_KOMMUN !== "true") return false;

  const productionUri = process.env.MONGODB_URI_PRODUCTION;
  if (productionUri && process.env.MONGODB_URI === productionUri) return false;

  return true;
}

/**
 * A safe-to-log identifier for a service key. We hold more than one and they
 * are indistinguishable by name, so logs need to say *which* was used without
 * ever printing the key itself.
 */
export function serviceFingerprint(config: GrandIdConfig): string {
  return `${config.env}:…${config.serviceKey.slice(-4)}`;
}
