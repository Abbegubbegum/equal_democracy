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
 * The two platforms take different journeys home from BankID, and sending both
 * down the same one strands whichever is on the wrong path:
 *
 *   iOS      `ASWebAuthenticationSession` is its own browser instance. Left to
 *            itself, BankID returns to Safari proper — a tab with none of the
 *            flow's state — and the callbackUrl redirect never fires. The
 *            appRedirect skips the browser entirely and lands in the app.
 *
 *   Android  The Chrome Custom Tab is what drives GrandID's hosted page to
 *            completion, and that page is what finalises the session. An
 *            appRedirect short-circuits BankID straight back to the app, the
 *            tab is left parked mid-flow, and GrandID never learns the order
 *            finished — so GetSession answers NOTLOGGEDIN forever.
 *
 * That second half is measured, not theorised: on 2026-09-01 an Android login
 * was polled thirty times over 82 seconds, after a *successful* signature, and
 * every single GetSession came back `unknown:NOTLOGGEDIN` with no state change
 * at all. Removing the appRedirect is what lets the browser finish.
 *
 * Anything that is not Android keeps it. `web` covers a phone browser, where
 * the iOS problem applies just the same, and `unknown` is the conservative
 * default — a missing appRedirect breaks iOS outright, while a spurious one
 * costs nothing anywhere the browser was going to be skipped regardless.
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
