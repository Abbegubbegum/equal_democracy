import * as SecureStore from "expo-secure-store";

// JSON-encoded Selection (lib/selection.ts) — a question or the active budget.
export const STORAGE_SELECTION = "rosta_selection";

/**
 * The contact phone number, mirrored on the device so the settings form can
 * paint before the network answers.
 *
 * Lives here rather than in SettingsModal because `logout()` has to clear it —
 * it belongs to the account, not the handset — and importing it from a
 * component would make auth-context and SettingsModal import each other.
 */
export const STORAGE_PHONE = "user_phone_number";

export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
