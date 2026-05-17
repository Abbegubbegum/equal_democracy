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
