import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { BASE_URL } from "./api";
import { getItem, setItem } from "./storage";

/**
 * "Is this build still current?" — asked on cold start and on every foreground.
 *
 * The verdict, the store link and the user-facing copy all come from the server
 * (GET /api/mobile/app-version), never from anything bundled here. A build that
 * is already installed cannot be fixed by a web deploy, so the one thing it must
 * do is ask; everything else is the server's call.
 */

const STORAGE_UPDATE_DISMISSED = "update_prompt_dismissed_version";

/** The running build's user-facing version, straight from app.json. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";

const REQUEST_TIMEOUT_MS = 8000;

export type VersionStatus = "ok" | "update-available" | "update-required";

export interface VersionCheck {
  status: VersionStatus;
  current: string | null;
  latest: string;
  minSupported: string;
  storeUrl: string;
  title: string | null;
  message: string | null;
  actionLabel: string | null;
}

/**
 * Fails open: any network error, timeout or unexpected shape returns null and
 * the app carries on. A flaky connection must never look like a forced update.
 */
export async function checkAppVersion(): Promise<VersionCheck | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const query = `version=${encodeURIComponent(APP_VERSION)}&platform=${Platform.OS}`;
    const res = await fetch(`${BASE_URL}/api/mobile/app-version?${query}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as VersionCheck;
    if (
      data?.status !== "ok" &&
      data?.status !== "update-available" &&
      data?.status !== "update-required"
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── "Later" for the soft nudge ───────────────────────────────────────────────
// Keyed by the version that was offered, so dismissing 1.3.0 stays dismissed
// forever but 1.4.0 gets to ask once. A forced update ignores this entirely.

export async function isUpdateDismissed(version: string): Promise<boolean> {
  try {
    return (await getItem(STORAGE_UPDATE_DISMISSED)) === version;
  } catch {
    return false;
  }
}

export async function dismissUpdate(version: string): Promise<void> {
  try {
    await setItem(STORAGE_UPDATE_DISMISSED, version);
  } catch {
    // Worst case the nudge shows again next launch — not worth surfacing.
  }
}

/** Opens the store listing for this platform. */
export async function openStore(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
