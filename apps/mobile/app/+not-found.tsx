import { Redirect } from "expo-router";

/**
 * Catch-all for deep links that match no route.
 *
 * Without this the app had nothing to render for an unknown path — the root
 * layout is a <Slot />, not a navigator, so there was no screen to present
 * Expo Router's built-in unmatched route in. A bad return URL from the Swish
 * app-switch crashed the app instead of failing gracefully.
 *
 * Deep links come from outside the app (Swish, BankID, push notifications, the
 * QR code), so they are not fully under our control — sending the user to the
 * start screen is always better than terminating.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
