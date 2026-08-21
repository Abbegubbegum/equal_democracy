import {
  getItem,
  setItem,
  deleteItem,
  STORAGE_SELECTED_QUESTION,
} from "./storage";

/**
 * The question the user is currently working on (shown on Rösta).
 *
 * Persisted in SecureStore so it survives app restarts, plus an in-memory
 * listener list so an *already mounted and focused* screen reacts to a change.
 * The focus-based reload in vote.tsx is not enough on its own: when a push
 * notification is tapped while the app is already sitting on Rösta, the screen
 * never blurs, so nothing re-reads storage and the user would keep looking at
 * the previous question.
 */
type Listener = (questionId: string | null) => void;

const listeners = new Set<Listener>();

export function getSelectedQuestion(): Promise<string | null> {
  return getItem(STORAGE_SELECTED_QUESTION);
}

export async function selectQuestion(questionId: string): Promise<void> {
  await setItem(STORAGE_SELECTED_QUESTION, questionId);
  for (const listener of listeners) listener(questionId);
}

export async function clearSelectedQuestion(): Promise<void> {
  await deleteItem(STORAGE_SELECTED_QUESTION);
  for (const listener of listeners) listener(null);
}

/** Returns an unsubscribe function — use it as an effect cleanup. */
export function onSelectedQuestionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
