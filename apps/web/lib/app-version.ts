/**
 * Version policy for the mobile app: which build is current, which builds are
 * still allowed to talk to this API, and where to send people to update.
 *
 * The mobile app asks for this on every cold start and every foreground
 * (GET /api/mobile/app-version) and renders whatever it gets back — the store
 * links and the Swedish copy included. Nothing here is bundled into the app, so
 * all of it can be changed by a web deploy without an App Store / Play release.
 * That is the whole point: a build that is already on someone's phone can only
 * be reached this way.
 */

// ── Store links ──────────────────────────────────────────────────────────────
// Also used by pages/app.tsx (the QR-code landing) — one definition, so the
// "where do I get the app" answer can never disagree with itself.

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=se.vallentunaframat.app";

// No region prefix — Apple routes each visitor to their own storefront.
// App Store Connect App ID 6781031191.
export const APP_STORE_URL = "https://apps.apple.com/app/id6781031191";

// ── Policy ───────────────────────────────────────────────────────────────────

/**
 * The newest build that is actually downloadable.
 *
 * Bump this only once the release is *live in both stores* — not when the EAS
 * build is submitted. Apple review sits between the two, and pointing users at
 * a version the store does not have yet means a nag they cannot act on.
 */
const LATEST_MOBILE_VERSION = "1.3.1";

/**
 * The oldest build still allowed to run. Users below this are hard-blocked with
 * an undismissable "update" wall instead of being left to hit 404s from routes
 * their build still calls.
 *
 * Deliberately a no-op floor right now. Raise it in the same change that
 * deletes or breaks a `/api/mobile/*` route an older build depends on — that is
 * the only thing this lever is for. Never raise it to a version the stores have
 * not finished rolling out, or you lock people out of an app they cannot fix.
 */
const MIN_SUPPORTED_MOBILE_VERSION = "1.3.0";

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Env override, for changing policy without a code change. Ignored unless semver. */
function fromEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && SEMVER.test(value.trim()) ? value.trim() : fallback;
}

export function getVersionPolicy(): { latest: string; minSupported: string } {
  return {
    latest: fromEnv("MOBILE_LATEST_VERSION", LATEST_MOBILE_VERSION),
    minSupported: fromEnv(
      "MOBILE_MIN_SUPPORTED_VERSION",
      MIN_SUPPORTED_MOBILE_VERSION,
    ),
  };
}

/**
 * Numeric X.Y.Z comparison: negative if a < b, 0 if equal, positive if a > b.
 * Returns null when either side isn't a plain semver triple — callers treat
 * that as "don't know", never as "out of date".
 */
export function compareVersions(a: string, b: string): number | null {
  if (!SEMVER.test(a) || !SEMVER.test(b)) return null;
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}
