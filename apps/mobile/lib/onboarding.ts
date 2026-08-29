import { getItem, setItem } from "./storage";

const KEYS = {
  loginCount: "onboarding_login_count",
  promptShown: "onboarding_prompt_shown",
  profileDone: "onboarding_profile_done",
};

export async function incrementLoginCount(): Promise<number> {
  const raw = await getItem(KEYS.loginCount);
  const next = parseInt(raw ?? "0", 10) + 1;
  await setItem(KEYS.loginCount, String(next));
  return next;
}

export async function getOnboardingState() {
  const [lc, ps, pd] = await Promise.all([
    getItem(KEYS.loginCount),
    getItem(KEYS.promptShown),
    getItem(KEYS.profileDone),
  ]);
  return {
    loginCount: parseInt(lc ?? "0", 10),
    promptShownCount: parseInt(ps ?? "0", 10),
    profileCompleted: pd === "true",
  };
}

export async function markPromptShown(): Promise<void> {
  const raw = await getItem(KEYS.promptShown);
  const next = parseInt(raw ?? "0", 10) + 1;
  await setItem(KEYS.promptShown, String(next));
}

export async function markProfileCompleted(): Promise<void> {
  await setItem(KEYS.profileDone, "true");
}

// ── The post-signup account-claim prompt ─────────────────────────────────────

const CLAIM_KEY = "claim_prompt_pending";

/**
 * Marks that this device should ask "did you already have an account with
 * email?" the next time the app screens mount.
 *
 * Set by the login screen when BankID *created* an account rather than finding
 * one, and read once by `(app)/_layout.tsx`. It is a handoff between two screens
 * that never render together, which is why it goes through storage rather than
 * state — the login screen replaces itself with the tab navigator.
 *
 * Deliberately one-shot: someone who skips has said no, and being asked again
 * on every cold start would be nagging. They can still claim the address later
 * from the settings sheet, which is the same flow.
 */
export async function markClaimPromptPending(): Promise<void> {
  await setItem(CLAIM_KEY, "true");
}

/**
 * In-process latch, on top of the stored flag.
 *
 * The stored flag alone is not enough: reading it is async, and the tab layout
 * can mount twice in quick succession right after login (the auth layout
 * redirects as the login screen replaces itself). Both mounts then `await
 * getItem` before either has written `false`, both see `true`, and the sheet
 * appears twice — which is exactly what happened.
 *
 * A module-level flag closes that window, because it is set synchronously.
 */
let takenThisSession = false;

export async function takeClaimPrompt(): Promise<boolean> {
  if (takenThisSession) return false;

  const pending = (await getItem(CLAIM_KEY)) === "true";
  if (!pending) return false;

  // Latched only once something was actually consumed. Setting it on every call
  // meant the first read — which can happen before the login screen has written
  // the flag — permanently disarmed the prompt.
  takenThisSession = true;
  await setItem(CLAIM_KEY, "false");
  return true;
}
