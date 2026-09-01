import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState, AppStateStatus, Platform } from "react-native";
import { BASE_URL, getAccessToken } from "./api";

/**
 * Client-side trace for the one part of this flow the server cannot see: what
 * the *browser* did.
 *
 * The server knows only that GrandID keeps answering NOTLOGGEDIN. It cannot
 * tell whether the hosted page was closed, backgrounded, or returned to — and
 * on Android that distinction is the whole question, because the browser tab is
 * what drives GrandID's page to completion. Tagged so it can be picked out of
 * logcat with `adb logcat | grep BankIdLogin`.
 */
function trace(event: string, detail: Record<string, unknown> = {}) {
  console.log(`[BankIdLogin] ${event}`, {
    platform: Platform.OS,
    ...detail,
  });
}

/**
 * BankID **login** — the identification twin of ./bankid.ts.
 *
 * Every mechanical note in that file applies here unchanged: hosted UI rather
 * than an app-switch (SPAR only comes back from the hosted flow), the system
 * browser rather than a WebView (a WebView cannot follow `bankid://`), and a
 * `callbackUrl` that must exist as a route so the return trip has somewhere to
 * land. Read that file's header for the reasoning.
 *
 * Two things differ, and both matter:
 *
 * 1. **It identifies, it does not sign.** Logging in is not agreeing to
 *    anything. The server picks the authentication service for this, and
 *    refuses a transaction that comes back as a signature.
 * 2. **It cannot use `apiClient`.** There is no token yet — that is the point —
 *    so these calls are plain `fetch`. `apiClient`'s silent 401-refresh would be
 *    meaningless here and its Authorization header would be empty.
 *
 * The `link` purpose is the exception: it runs inside an existing session and
 * does send the bearer token, because it attaches BankID to *that* account.
 */

export type LoginStatus =
  "PENDING" | "VERIFIED" | "REJECTED" | "FAILED" | "CANCELLED";

export interface StartedLogin {
  pollToken: string;
  redirectUrl: string;
  resumed: boolean;
}

export interface LoginState {
  status: LoginStatus | "ALREADY_CONSUMED";
  reasonCode?: string | null;
  /** Swedish, ready to show. Empty while still pending. */
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string | null;
    name: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
  capability?: string;
  capabilityMessage?: string;
  createdAccount?: boolean;
}

/** BankID gives about 3 minutes; watch a little past it rather than inventing a timeout. */
const WATCH_TIMEOUT_MS = 4 * 60 * 1000;
/** GrandID's own floor is one GetSession every 2 seconds. */
const POLL_INTERVAL_MS = 2000;

/**
 * Where GrandID sends the browser once identification is done.
 *
 * `/login` must stay a real route — an unmatched deep link has no navigator to
 * land in, which is what crashed the app on return from Swish. The same string
 * goes to the server and to `openAuthSessionAsync`, and they must match exactly.
 */
export function loginReturnUrl(): string {
  return Linking.createURL("/login").replace(":///", "://");
}

async function post(path: string, body: unknown, withToken: boolean) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (withToken) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message ?? "BankID kunde inte startas.");
  }
  return data;
}

/**
 * Starts an identification order.
 *
 * `purpose: "link"` attaches BankID to the account already signed in, which is
 * how a legacy email account stops being blocked.
 */
export async function startBankIdLogin(
  purpose: "login" | "link" = "login",
): Promise<StartedLogin> {
  const returnUrl = loginReturnUrl();
  trace("start", { purpose, returnUrl });
  const started = await post(
    "/api/mobile/auth/bankid",
    { purpose, returnUrl },
    purpose === "link",
  );
  trace("started", { purpose, resumed: started.resumed });
  return started;
}

/** Best effort — the order expires on its own, so a failure here is not shown. */
export async function cancelBankIdLogin(pollToken: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/mobile/auth/bankid/${pollToken}`, {
      method: "DELETE",
    });
  } catch {
    /* ignore */
  }
}

/**
 * Opens GrandID's hosted page and waits for the browser to hand back control.
 *
 * The result describes the *browser*, not the identification — a closed tab
 * proves nothing, and a user may close it straight after succeeding. The poll
 * decides.
 */
export async function openHostedLogin(redirectUrl: string): Promise<void> {
  trace("browser opening");
  try {
    const result = await WebBrowser.openAuthSessionAsync(
      redirectUrl,
      loginReturnUrl(),
      {
        toolbarColor: "#002d75",
        controlsColor: "#f5a623",
        enableBarCollapsing: true,
        showTitle: false,
      },
    );
    // The three answers mean very different things, and only this line
    // distinguishes them:
    //
    //   "success" — the callbackUrl fired: GrandID's page ran to completion and
    //               redirected. This is the healthy path.
    //   "dismiss" — the tab was closed without the redirect. On Android that is
    //               what an `appRedirect` short-circuit looks like: BankID sent
    //               the user straight back to the app, the tab was left behind
    //               mid-flow, and GrandID never finished the session.
    //   "cancel"  — the user backed out themselves.
    trace("browser closed", { type: result?.type });
  } catch (error) {
    trace("browser threw", { error: String(error) });
    /* the poll is what decides the outcome */
  }
}

export function dismissHostedLogin(): void {
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    /* not open, or nothing to dismiss on this platform */
  }
}

export interface WatchLoginHandlers {
  onState: (state: LoginState) => void;
  onTimeout: () => void;
}

/**
 * Polls a login order until it settles.
 *
 * Same two deliberate behaviours as `watchVerification`: an immediate poll when
 * the app returns to the foreground (OS timers are suspended while the user is
 * in the browser), and a failed request ignored rather than ending the watch.
 *
 * Note that a VERIFIED poll **spends** the order server-side and returns the
 * tokens exactly once. A later poll answers `ALREADY_CONSUMED`, which is a
 * normal end state rather than a failure — the first poll already had what it
 * needed.
 *
 * Returns a cancel function — always call it on unmount.
 */
export function watchBankIdLogin(
  pollToken: string,
  handlers: WatchLoginHandlers,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let polls = 0;
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
      const res = await fetch(
        `${BASE_URL}/api/mobile/auth/bankid/${pollToken}`,
      );
      const state: LoginState = await res.json();
      if (cancelled) return;

      // 404 means the order is gone — expired, or purged. Nothing to wait for.
      if (res.status === 404) {
        trace("order gone (404)");
        cancelled = true;
        clear();
        handlers.onState({
          status: "FAILED",
          message: "Inloggningen har gått ut. Försök igen.",
        });
        return;
      }

      // Every poll but the boring ones. PENDING at two-second intervals would
      // drown the log it is meant to make readable, so it is reported once a
      // minute purely to show the watcher is still alive.
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
    // The return from BankID or the browser lands here. Which of the two, and
    // whether a deep link accompanied it, is the Android question.
    trace("app state", { state });
    if (state === "active") pollNow();
  };

  const appState = AppState.addEventListener("change", onAppStateChange);
  // The strongest signal available: BankID (appRedirect) or GrandID
  // (callbackUrl) only sends it once identification has finished, and on iOS the
  // app can come back reporting `inactive` rather than `active`.
  const deepLink = Linking.addEventListener("url", (event) => {
    // Its absence is the finding. If the app comes back to the foreground with
    // no url event, nothing redirected — the user switched back by hand, and
    // whatever was supposed to carry them home did not fire.
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
