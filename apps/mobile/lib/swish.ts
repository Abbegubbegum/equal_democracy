import * as Linking from "expo-linking";
import { AppState, AppStateStatus } from "react-native";
import { apiClient } from "./api";

export type PaymentStatus =
  "CREATED" | "PAID" | "DECLINED" | "ERROR" | "CANCELLED";

export interface CreatedPayment {
  paymentId: string;
  token: string;
  amount: number;
  /** True when the server handed back a payment that was already in flight. */
  resumed: boolean;
}

export interface PaymentStatusResponse {
  paymentId: string;
  status: PaymentStatus;
  errorCode: string | null;
  /** Payer-facing Swedish text, or null when there is nothing to say. */
  message: string | null;
  membership: { status: "none" | "active"; paidUntil: string | null };
}

export interface Membership {
  status: "none" | "active";
  paidUntil: string | null;
  firstPaidAt: string | null;
  feeSek: number;
  years: number[];
}

/**
 * Swish gives the payer 3 minutes and its backend gives up at 5.5, after which
 * it reports ERROR/TM01. We watch a little past that so the real outcome has a
 * chance to arrive rather than us inventing a timeout of our own.
 */
const WATCH_TIMEOUT_MS = 6.5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

export async function getMembership(): Promise<Membership> {
  return apiClient<Membership>("/api/mobile/user/membership");
}

export async function createMembershipPayment(): Promise<CreatedPayment> {
  return apiClient<CreatedPayment>("/api/mobile/payments/swish", {
    method: "POST",
    body: "{}",
  });
}

/**
 * The URL that hands control to the Swish app.
 *
 * `callbackurl` is where Swish (or BankID) sends the user afterwards, so it has
 * to be *this* app's scheme — which differs between Expo Go (`exp://…`) and a
 * standalone build (`vallentunaframat://`). Linking.createURL resolves that for
 * us, which is why the server returns only the token and never a ready-made URL.
 */
export function buildSwishUrl(token: string): string {
  // Must be a route that actually exists. Anything else lands on Expo Router's
  // unmatched-route path, which this app has no navigator to present (the root
  // layout is a <Slot />) — that crashed the app on return from Swish.
  //
  // "/membership" is the Info tab (app/(app)/membership.tsx — route groups are
  // not part of the URL), which is the screen the user started from. Returning
  // to the screen they are already on means no navigation happens: the payment
  // sheet stays mounted and its AppState listener polls immediately.
  const returnUrl = Linking.createURL("/membership");
  return `swish://paymentrequest?token=${token}&callbackurl=${encodeURIComponent(returnUrl)}`;
}

/**
 * Hands off to the Swish app. Returns false when Swish is not installed, so the
 * caller can say so rather than leaving the user staring at a spinner.
 */
export async function openSwishApp(token: string): Promise<boolean> {
  const url = buildSwishUrl(token);
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export interface WatchHandlers {
  onStatus: (status: PaymentStatusResponse) => void;
  /** Called once, when we give up waiting. */
  onTimeout: () => void;
}

/**
 * Polls a payment until it reaches a terminal state.
 *
 * Two things this deliberately handles: while the user is in the Swish app our
 * timers are suspended by the OS, so returning to the foreground triggers an
 * immediate poll rather than waiting out the interval; and a failed request is
 * ignored rather than ending the watch, because a dropped connection mid-payment
 * is common and the next poll usually succeeds.
 *
 * Returns a cancel function — always call it on unmount.
 */
export function watchPayment(
  paymentId: string,
  handlers: WatchHandlers,
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
      const res = await apiClient<PaymentStatusResponse>(
        `/api/mobile/payments/${paymentId}`,
      );
      if (cancelled) return;

      handlers.onStatus(res);

      if (res.status !== "CREATED") {
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

  const onAppStateChange = (state: AppStateStatus) => {
    // Coming back from the Swish app is the single most likely moment for the
    // status to have changed, so check straight away instead of on the interval.
    if (state === "active" && !cancelled) {
      clear();
      poll();
    }
  };

  const subscription = AppState.addEventListener("change", onAppStateChange);
  poll();

  return () => {
    cancelled = true;
    clear();
    subscription.remove();
  };
}
