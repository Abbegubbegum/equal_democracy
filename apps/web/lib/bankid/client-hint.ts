/**
 * Which kind of client is driving a BankID flow, inferred from the User-Agent.
 *
 * This exists for one reason: **the return trip from BankID is not the same
 * journey on iOS and Android**, so a bug that only reproduces on one of them is
 * unreadable in the logs without knowing which one made the call. See the
 * `appRedirect` parameter in ./session.ts for what actually differs.
 *
 * Deliberately inferred rather than sent by the client. A `platform` field in
 * the request body would be the cleaner design, but it would only reach devices
 * after an EAS build and a store release — and the builds we most need to
 * diagnose are the ones already installed. The User-Agent is there today:
 * React Native's fetch goes through okhttp on Android and CFNetwork/Darwin on
 * iOS, both of which say so plainly.
 *
 * Nothing branches on this. It is a log label, and if it is ever wrong the only
 * cost is a mislabelled line — so it guesses freely rather than refusing.
 */

import type { NextApiRequest } from "next";

export type ClientPlatform = "android" | "ios" | "web" | "unknown";

export interface ClientHint {
  platform: ClientPlatform;
  /** Truncated — a UA is unbounded, and only the first stretch identifies it. */
  userAgent: string;
}

/**
 * Whether to tell the BankID app to return straight to us, given who is asking.
 *
 * **Android must not get an `appRedirect`, and iOS cannot work without one.**
 * Not because of which app the BankID app returns to as such — the real fault
 * line is what kind of browser is holding the flow, and that comment applied
 * back when the app opened GrandID's hosted page in a Chrome Custom Tab (via
 * `expo-web-browser`'s Android "auth session" polyfill). A Custom Tab lives
 * inside the *host app's own task* — ours — and Android does not reliably
 * return it to the foreground once BankID hands back control; our app comes
 * forward instead, and the Custom Tab is left alive but stranded behind it,
 * mid-flow, with GrandID's page never getting the chance to finish and fire its
 * own callback. `GetSession` then reports `NOTLOGGEDIN` until the order
 * expires — the transaction succeeded, but nothing was ever there to notice.
 *
 * Fixed by not using a Custom Tab on Android at all: the app now hands the
 * GrandID URL to `Linking.openURL`, which launches the OS's actual default
 * browser as its **own separate task**, exactly as if the user had typed the
 * URL in themselves. That is the ordinary way every website's mobile BankID
 * login works, and Android's own back-stack already knows how to return
 * control to whichever app launched an intent — no `appRedirect` required.
 * Verified 2026-09-02 two ways: navigating to the same hosted URL manually in
 * Chrome (bypassing the app and any Custom Tab entirely) completed and
 * redirected correctly with no `appRedirect` set, and the client fix
 * (`Linking.openURL` in `apps/mobile/lib/bankid.ts` / `bankid-login.ts`)
 * reproduces exactly that path from inside the app.
 *
 * iOS is unrelated to any of this. `ASWebAuthenticationSession` is its own
 * browser instance, separate from Safari proper — left alone, BankID returns
 * to a blank Safari tab with none of the session's state, and the callbackUrl
 * redirect never fires. The `appRedirect` skips the browser entirely there and
 * lands straight in the app.
 *
 * GrandID does **not** validate `appRedirect` (any value is accepted, even on
 * Android, where one is simply never sent) — a wrong one fails silently after
 * signing.
 */
export function appRedirectFor(
  platform: ClientPlatform,
  returnUrl: string,
): string | undefined {
  if (!returnUrl) return undefined;
  return platform === "android" ? undefined : returnUrl;
}

export function clientHint(req: NextApiRequest): ClientHint {
  const raw = String(req.headers["user-agent"] || "");
  const ua = raw.toLowerCase();

  let platform: ClientPlatform = "unknown";
  if (/okhttp|android|dalvik/.test(ua)) {
    platform = "android";
  } else if (/cfnetwork|darwin|iphone|ipad|ios/.test(ua)) {
    // Order matters: Expo Go on Android reports okhttp and nothing else, but an
    // iOS UA can mention Darwin *and* a Mozilla product token, so the mobile
    // markers are tested before the browser one below.
    platform = "ios";
  } else if (/mozilla|chrome|safari|firefox/.test(ua)) {
    platform = "web";
  }

  return { platform, userAgent: raw.slice(0, 120) };
}
