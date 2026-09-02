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
 * Which GrandID host to call, and which credential set to send it. Not the
 * same thing as which runtime is calling — see `runtimeEnv()`. This is
 * `production` in every deployed environment.
 *
 * `test` and `production` are separate GrandID installations with separate
 * customer provisioning (see the deployment table below), so this one flag has
 * to switch two things together: the host (`baseUrlFor`) and the credentials
 * (`required` below picks a `_TEST`-suffixed var when this is `"test"`, the
 * bare var otherwise). Switching `GRANDID_ENV` alone without also switching the
 * keys would send one environment's credentials at the other's host.
 *
 * Locally this means the two are edited together in `.env.local`: flip
 * `GRANDID_ENV`, and the matching `GRANDID_API_KEY_TEST` /
 * `GRANDID_SIGN_SERVICE_KEY_TEST` / `GRANDID_AUTH_SERVICE_KEY_TEST` trio (or
 * the bare production names) is what gets read — restart the dev server
 * after, since these are read once at process start and cached (see `cache`
 * below). See the 2026-09-02 addendum to §8 of the integration plan for what's
 * confirmed working on the test host so far (`auth` only, not `sign`).
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
 * `client-test.grandid.com` no longer belongs on this list unconditionally —
 * see the type doc above and the §8 addendum for what changed between then and
 * 2026-09-02, and for which service that's confirmed on.
 *
 * So our account lives on EU production, plus (as of the addendum) test for
 * `auth`. Switching to the SE hosts would
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

/**
 * Which of our two configured GrandID services to run.
 *
 * The service key — not the request — decides whether BankID signs or merely
 * identifies (see `readOrderType` in ./session.ts, and §2a of
 * docs/bankid-integration-plan.md). So this is not a preference, it is the whole
 * semantics of the transaction:
 *
 *   `sign` → `funcId: Signing`         — a vote. The voter is agreeing to a
 *                                        ballot text, and the signature is what
 *                                        binds them to it.
 *   `auth` → `funcId: Identification`  — a login. The user is agreeing to
 *                                        nothing, so signing would be a lie
 *                                        about what just happened.
 *
 * Both return the SPAR folkbokföring block in GUI mode, which is what lets
 * eligibility be decided at login rather than at the end of a signature the user
 * has already paid for (docs/bankid-login-plan.md §2).
 *
 * Getting these backwards produces transactions that succeed and mean nothing —
 * no error surfaces anywhere — which is why every consumer asserts the order
 * type it expected rather than trusting the key it asked for.
 */
export type GrandIdService = "sign" | "auth";

const SERVICE_KEY_VARS: Record<GrandIdService, string> = {
  sign: "GRANDID_SIGN_SERVICE_KEY",
  auth: "GRANDID_AUTH_SERVICE_KEY",
};

export interface GrandIdConfig {
  env: GrandIdEnv;
  service: GrandIdService;
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

/**
 * Reads a credential var for the given env: `${baseName}_TEST` when `env` is
 * `"test"`, the bare `baseName` (the production value, same as Vercel)
 * otherwise. This — not `baseUrlFor` alone — is what makes `GRANDID_ENV` a
 * complete environment switch rather than just a host change.
 */
function required(baseName: string, env: GrandIdEnv): string {
  const name = env === "test" ? `${baseName}_TEST` : baseName;
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. GrandID needs GRANDID_ENV plus, for whichever ` +
        `env that is, GRANDID_API_KEY, GRANDID_SIGN_SERVICE_KEY (signing, ` +
        `for votes) and GRANDID_AUTH_SERVICE_KEY (authentication, for login) ` +
        `— bare names for production, a "_TEST" suffix on each for test. Run ` +
        `\`node scripts/test-grandid-connection.mjs --probe\` to work out which ` +
        `service key belongs to which environment.`,
    );
  }
  return value;
}

/**
 * Cached per service *and* env: the two environments differ in every field but
 * `service`, and env is read fresh from `process.env` here, so a stale cache
 * entry from the wrong env would otherwise survive a value that only changes
 * between process restarts in practice but has no reason to be assumed to.
 */
const cache: Record<string, GrandIdConfig> = {};

export function getGrandIdConfig(service: GrandIdService): GrandIdConfig {
  const env = (process.env.GRANDID_ENV || "test") as GrandIdEnv;
  const cacheKey = `${service}:${env}`;
  const hit = cache[cacheKey];
  if (hit) return hit;

  const config: GrandIdConfig = {
    env,
    service,
    baseUrl: baseUrlFor(env),
    apiKey: required("GRANDID_API_KEY", env),
    serviceKey: required(SERVICE_KEY_VARS[service], env),
  };
  cache[cacheKey] = config;
  return config;
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
 *
 * The role is included as well as the last four characters, because the whole
 * class of bug this guards against is a key configured under the wrong name —
 * where the role we asked for and the key we got do not agree.
 */
export function serviceFingerprint(config: GrandIdConfig): string {
  return `${config.env}:${config.service}:…${config.serviceKey.slice(-4)}`;
}
