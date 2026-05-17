import { getItem, setItem } from "./storage";
import { STORAGE_INTERESTS } from "./SettingsModal";

const KEY_LOGIN_COUNT = "onboarding_login_count";
const KEY_PROMPT_SHOWN_COUNT = "onboarding_prompt_shown_count";

export async function incrementLoginCount(): Promise<number> {
  const raw = await getItem(KEY_LOGIN_COUNT);
  const count = raw ? parseInt(raw, 10) + 1 : 1;
  await setItem(KEY_LOGIN_COUNT, String(count));
  return count;
}

export async function getOnboardingState(): Promise<{
  promptShownCount: number;
  profileCompleted: boolean;
}> {
  const [promptRaw, interestsRaw] = await Promise.all([
    getItem(KEY_PROMPT_SHOWN_COUNT),
    getItem(STORAGE_INTERESTS),
  ]);
  return {
    promptShownCount: promptRaw ? parseInt(promptRaw, 10) : 0,
    profileCompleted: interestsRaw !== null,
  };
}

export async function markPromptShown(): Promise<void> {
  const raw = await getItem(KEY_PROMPT_SHOWN_COUNT);
  const count = raw ? parseInt(raw, 10) + 1 : 1;
  await setItem(KEY_PROMPT_SHOWN_COUNT, String(count));
}
