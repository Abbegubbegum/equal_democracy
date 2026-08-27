import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState, AppStateStatus } from "react-native";
import { BASE_URL, getAccessToken } from "./api";

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
  return post(
    "/api/mobile/auth/bankid",
    { purpose, returnUrl: loginReturnUrl() },
    purpose === "link",
  );
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
  try {
    await WebBrowser.openAuthSessionAsync(redirectUrl, loginReturnUrl(), {
      toolbarColor: "#002d75",
      controlsColor: "#f5a623",
      enableBarCollapsing: true,
      showTitle: false,
    });
  } catch {
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
  const startedAt = Date.now();

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const poll = async () => {
    if (cancelled) return;

    if (Date.now() - startedAt > WATCH_TIMEOUT_MS) {
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
        cancelled = true;
        clear();
        handlers.onState({
          status: "FAILED",
          message: "Inloggningen har gått ut. Försök igen.",
        });
        return;
      }

      handlers.onState(state);

      if (state.status !== "PENDING") {
        cancelled = true;
        clear();
        return;
      }
    } catch {
      // Transient — keep waiting.
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
    if (state === "active") pollNow();
  };

  const appState = AppState.addEventListener("change", onAppStateChange);
  // The strongest signal available: BankID (appRedirect) or GrandID
  // (callbackUrl) only sends it once identification has finished, and on iOS the
  // app can come back reporting `inactive` rather than `active`.
  const deepLink = Linking.addEventListener("url", pollNow);

  poll();

  return () => {
    cancelled = true;
    clear();
    appState.remove();
    deepLink.remove();
  };
}
