import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState, AppStateStatus, Platform } from "react-native";
import { apiClient } from "./api";

/**
 * BankID vote verification.
 *
 * Deliberately not an app-switch. GrandID only returns SPAR folkbokföring data
 * for its hosted-UI flow, which hands back a `login.grandid.com` URL rather than
 * an autostart token — so there is nothing to `bankid://` into, and the voter
 * completes the signature on that page instead.
 *
 * It opens in the **system browser**, never a WebView. GrandID's own Mobile
 * Integrations guide warns that a WebView breaks when the hosted page launches
 * `bankid://` (`ERR_UNKNOWN_URL_SCHEME`) and that the app must intercept that
 * navigation itself; the system browser lets the OS handle the scheme, which is
 * the same reason OAuth flows use it.
 *
 * The two platforms get there differently, and that difference is load-bearing
 * (see `openHostedLogin` below for the full story). **iOS** uses
 * `openAuthSessionAsync` — an `ASWebAuthenticationSession` that lives inside the
 * app and hands control back on `callbackUrl`. **Android** uses
 * `Linking.openURL`, launching the OS's real default browser as its own task,
 * rather than `openAuthSessionAsync`'s Android implementation (a Chrome Custom
 * Tab scoped to *our* task, which BankID's same-device return does not reliably
 * bring back to the foreground — the tab is left alive but stranded behind our
 * app, and GrandID's page never finishes). Android's own back-stack returns
 * control to whichever app launched the browser intent once the signature
 * flow's `callbackUrl` redirect fires, the same as any BankID-on-the-web login.
 *
 * That return trip is not a nicety. `WebBrowser.dismissBrowser()` is iOS-only,
 * so without a callbackUrl an Android user would sign, land back on GrandID's
 * completion page, and have to press back to discover their vote had counted.
 *
 * The outcome never comes from the browser. Our server polls GrandID and writes
 * the vote; the app learns about it by polling us. Closing the browser early
 * therefore proves nothing — see `watchVerification`.
 */

/**
 * What the browser did, which is the half of this flow the server cannot see.
 *
 * The twin of the same function in ./bankid-login.ts — read its comment for the
 * reasoning. Votes matter more than logins here, because a voter hits this
 * repeatedly and an unexplained hang on election day is not recoverable by
 * asking them to try again tomorrow.
 */
let currentVerificationId: string | null = null;

function trace(event: string, detail: Record<string, unknown> = {}) {
  console.log(`[BankIdVote] ${event}`, {
    platform: Platform.OS,
    ...detail,
  });

  const verificationId = currentVerificationId;
  if (!verificationId) return;
  // Through apiClient: unlike login, a vote always has a session, and the
  // server scopes the trace to the caller's own order.
  apiClient("/api/mobile/bankid-trace", {
    method: "POST",
    body: JSON.stringify({ verificationId, event, detail }),
  }).catch(() => {
    /* diagnostics must never break the flow */
  });
}

export type VerificationStatus =
  "PENDING" | "VERIFIED" | "REJECTED" | "FAILED" | "CANCELLED";

export interface StartedVerification {
  verificationId: string;
  redirectUrl: string;
  /** True when the server handed back an order that was already in flight. */
  resumed: boolean;
}

export interface VerificationState {
  verificationId: string;
  status: VerificationStatus;
  /** EligibilityCode or BankID hintCode. For logging, not for display. */
  reasonCode: string | null;
  /** Swedish, ready to show. Empty while still pending. */
  message: string;
  voteCounts: { ja: number; nej: number } | null;
  userVote: "ja" | "nej" | null;
}

/**
 * BankID gives the signer about 3 minutes. We watch a little past that so the
 * real outcome has a chance to arrive rather than us inventing a timeout.
 */
const WATCH_TIMEOUT_MS = 4 * 60 * 1000;

/** The API's own floor is one GetSession poll every 2 seconds. */
const POLL_INTERVAL_MS = 2000;

/**
 * How long a still-PENDING signature waits before the UI offers a way out.
 *
 * See the twin constant in ./bankid-login.ts. Only an offer — the watch keeps
 * polling, so a slow signer is never cut off.
 */
const STALL_AFTER_MS = 35 * 1000;

/**
 * Where GrandID sends the browser once the signature is done.
 *
 * The same string goes to the server as `callbackUrl` and to
 * `openAuthSessionAsync` as its return URL — they must match exactly or the
 * session will not recognise the redirect.
 *
 * Two shapes come out of `createURL` depending on where the app is running:
 * `vallentunaframat://vote` in a store build, `exp://10.0.0.5:8081/--/vote`
 * under Expo Go. Both are accepted by GrandID; `scheme:///vote` (three slashes,
 * which createURL can emit) is not, so it is collapsed here.
 *
 * `/vote` must stay a route that exists — an unmatched deep link has no
 * navigator to land in, which is what crashed the app on return from Swish.
 */
export function voteReturnUrl(): string {
  return Linking.createURL("/vote").replace(":///", "://");
}

export async function startVoteVerification(
  questionId: string,
  choice: "ja" | "nej",
): Promise<StartedVerification> {
  currentVerificationId = null;
  trace("start", { choice });
  const started = await apiClient<StartedVerification>(
    "/api/mobile/vote-verification",
    {
      method: "POST",
      body: JSON.stringify({
        questionId,
        choice,
        returnUrl: voteReturnUrl(),
      }),
    },
  );
  currentVerificationId = started.verificationId;
  trace("started", { resumed: started.resumed });
  return started;
}

export async function cancelVoteVerification(
  verificationId: string,
): Promise<void> {
  try {
    await apiClient(`/api/mobile/vote-verification/${verificationId}/cancel`, {
      method: "POST",
      body: "{}",
    });
  } catch {
    // Best effort. The order expires on its own, and a user who has walked away
    // must not be shown an error about the cleanup.
  }
}

/**
 * Opens GrandID's hosted page and waits for the browser to hand back control.
 *
 * The resolved result describes the *browser*, not the signature — `cancel`
 * only means the tab closed, which a user may do straight after signing
 * successfully. It is never treated as failure; the poll decides.
 *
 * **Android does not use `openAuthSessionAsync` at all** — that call's Android
 * implementation is a Chrome Custom Tab living inside *our own app's task* (see
 * `_openBrowserAndWaitAndroidAsync` in expo-web-browser's WebBrowser.ts: there
 * is no native auth session on this platform, only a JS polyfill racing a deep
 * link against `AppState` going `active`). When BankID hands control back,
 * Android brings our app's task forward, not the Custom Tab specifically, so
 * the tab is left alive but stranded behind our app mid-flow — GrandID's page
 * never gets the chance to finish and fire its own redirect, and `GetSession`
 * answers NOTLOGGEDIN until the order expires. The signature succeeds; nothing
 * is left running to notice.
 *
 * `Linking.openURL` launches the OS's real default browser instead, as its
 * **own separate task** — the same thing that happens when a URL is typed into
 * Chrome directly, which is the ordinary, working case every BankID-on-the-web
 * integration relies on. Android's own back-stack already returns control to
 * whichever app launched an intent, so no `appRedirect` is needed here (see
 * `appRedirectFor` in the server's `lib/bankid/client-hint.ts`). Verified
 * 2026-09-02: opening the same hosted URL by hand in Chrome — bypassing the app
 * and any Custom Tab entirely — completed and redirected correctly with no
 * `appRedirect` set at all.
 */
export async function openHostedLogin(redirectUrl: string): Promise<boolean> {
  trace("browser opening");
  if (Platform.OS === "android") {
    try {
      await Linking.openURL(redirectUrl);
      return true;
    } catch (error) {
      trace("browser threw", { error: String(error) });
      return false;
    }
  }
  try {
    const result = await WebBrowser.openAuthSessionAsync(
      redirectUrl,
      voteReturnUrl(),
      {
        // Ignored on Android now that it never reaches this branch — kept for
        // iOS, where the native auth session still renders this chrome.
        toolbarColor: "#002d75",
        controlsColor: "#f5a623",
        enableBarCollapsing: true,
        showTitle: false,
      },
    );
    // "success" means the callbackUrl fired and GrandID's page ran to
    // completion; "dismiss" the tab was closed without it; "cancel" is the
    // user backing out. None of these are treated as failure — the poll
    // decides.
    trace("browser closed", { type: result?.type });
    return true;
  } catch (error) {
    trace("browser threw", { error: String(error) });
    return false;
  }
}

/**
 * Best-effort close, for the race where our poll sees the vote recorded before
 * GrandID's redirect fires. iOS only — on Android the redirect is what returns
 * the user, and there is no way to dismiss a Custom Tab from the app.
 */
export function dismissHostedLogin(): void {
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    // Not open, or the platform has nothing to dismiss.
  }
}

export interface WatchHandlers {
  onState: (state: VerificationState) => void;
  /** Called once, when we give up waiting. */
  onTimeout: () => void;
}

/**
 * Polls a verification until it reaches a terminal state.
 *
 * Two things this handles deliberately: OS timers are suspended while the user
 * is in the browser, so returning to the foreground triggers an immediate poll
 * rather than waiting out the interval; and a failed request is ignored rather
 * than ending the watch, because a dropped connection mid-signature is common
 * and the next poll usually succeeds.
 *
 * Returns a cancel function — always call it on unmount.
 */
export function watchVerification(
  verificationId: string,
  handlers: WatchHandlers,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let polls = 0;
  let stalled = false;
  const startedAt = Date.now();

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const poll = async () => {
    if (cancelled) return;

    if (Date.now() - startedAt > WATCH_TIMEOUT_MS) {
      trace("watch timed out", { polls });
      cancelled = true;
      clear();
      handlers.onTimeout();
      return;
    }

    try {
      const state = await apiClient<VerificationState>(
        `/api/mobile/vote-verification/${verificationId}`,
      );
      if (cancelled) return;

      polls += 1;
      if (state.status !== "PENDING" || polls % 30 === 0) {
        trace("poll", {
          status: state.status,
          reasonCode: state.reasonCode,
          polls,
          elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      }

      handlers.onState(state);

      if (state.status !== "PENDING") {
        cancelled = true;
        clear();
        return;
      }

      // No UI hangs off this — it's a server-visible timing signal only, for
      // spotting a slow same-device hand-off in the logs.
      if (!stalled && Date.now() - startedAt > STALL_AFTER_MS) {
        stalled = true;
        trace("stalled", { polls });
      }
    } catch (error) {
      // Transient — keep waiting.
      trace("poll failed", { error: String(error) });
    }

    if (!cancelled) {
      clear();
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  const pollNow = () => {
    if (cancelled) return;
    clear();
    poll();
  };

  const onAppStateChange = (state: AppStateStatus) => {
    // Coming back from BankID or the browser is the most likely moment for the
    // signature to have completed, so check straight away rather than waiting
    // out the interval.
    trace("app state", { state });
    if (state === "active") pollNow();
  };

  const appState = AppState.addEventListener("change", onAppStateChange);

  // The deep link is the strongest signal available: BankID (via appRedirect)
  // or GrandID (via callbackUrl) only sends it once signing has finished. It is
  // also the more reliable of the two on iOS, where the app can come back with
  // the auth-session sheet still on top and report `inactive` rather than
  // `active`.
  const deepLink = Linking.addEventListener("url", (event) => {
    // Its absence is the finding: an app that returns to the foreground with no
    // url event was not redirected, it was switched back to by hand.
    trace("deep link", { url: event.url });
    pollNow();
  });

  poll();

  return () => {
    cancelled = true;
    clear();
    appState.remove();
    deepLink.remove();
  };
}
