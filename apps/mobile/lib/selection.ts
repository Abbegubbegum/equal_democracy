import { getItem, setItem, deleteItem, STORAGE_SELECTION } from "./storage";

/**
 * What the user is currently working on in the Rösta tab: either one Ja/Nej
 * question or the active budget process. Hem sets it, Rösta renders it.
 *
 * Persisted in SecureStore so it survives app restarts, plus an in-memory
 * listener list so an *already mounted and focused* screen reacts to a change.
 * The focus-based reload in vote.tsx is not enough on its own: when a push
 * notification is tapped while the app is already sitting on Rösta, the screen
 * never blurs, so nothing re-reads storage and the user would keep looking at
 * the previous selection.
 */
export type Selection =
  { kind: "question"; id: string } | { kind: "budget"; id: string };

type Listener = (selection: Selection | null) => void;

const listeners = new Set<Listener>();

function emit(selection: Selection | null) {
  for (const listener of listeners) listener(selection);
}

export async function getSelection(): Promise<Selection | null> {
  const raw = await getItem(STORAGE_SELECTION);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      (parsed?.kind === "question" || parsed?.kind === "budget") &&
      typeof parsed.id === "string"
    ) {
      return parsed;
    }
  } catch {
    // Unreadable value — treat as nothing selected.
  }
  return null;
}

async function select(selection: Selection): Promise<void> {
  await setItem(STORAGE_SELECTION, JSON.stringify(selection));
  emit(selection);
}

export function selectQuestion(questionId: string): Promise<void> {
  return select({ kind: "question", id: questionId });
}

/** `sessionId` is BudgetSession.sessionId — the id the web's /budget/[sessionId] uses. */
export function selectBudget(sessionId: string): Promise<void> {
  return select({ kind: "budget", id: sessionId });
}

export async function clearSelection(): Promise<void> {
  await deleteItem(STORAGE_SELECTION);
  emit(null);
}

/** Returns an unsubscribe function — use it as an effect cleanup. */
export function onSelectionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function sameSelection(a: Selection | null, b: Selection | null) {
  return a?.kind === b?.kind && a?.id === b?.id;
}
