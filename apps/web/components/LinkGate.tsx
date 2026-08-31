import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";

/**
 * Blocks a legacy email account until it connects BankID.
 *
 * These are the users who were already signed in when BankID login shipped —
 * most of the active ones, since a NextAuth session lasts 30 days. Their
 * account still works, but it cannot act: `capability` is `needs_bankid`, and
 * every write refuses.
 *
 * It blocks the **account**, not the app. The second button logs out to
 * anonymous browsing, which is the whole point of anonymous browsing existing:
 * an account must never become a trap, and the entire site is readable without
 * one.
 *
 * Keyed on `capability === "needs_bankid"` rather than on "is there a session",
 * so a BankID user who is merely ineligible — nothing to link, nothing to fix —
 * never sees it. That distinction is why `needs_bankid` is its own state.
 *
 * The link flow is the same three steps as the login page, with
 * `purpose: "link"`: start, leave for GrandID, come back and poll. On success
 * the BankID identity is attached to *this* account, and if the person already
 * had a separate BankID account, that one is folded into this one.
 */

const AMBER = "#f5a623";
const DARK_BLUE = "#001c55";

const TOKEN_KEY = "bankid_link_poll_token";
const POLL_INTERVAL_MS = 2000;
const POLL_DEADLINE_MS = 4 * 60 * 1000;

type Phase = "idle" | "starting" | "awaiting";

export default function LinkGate() {
  const { status } = useSession();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const pollingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/user/me");
      if (!res.ok) return;
      const data = await res.json();
      setBlocked(data.capability === "needs_bankid");
    } catch {
      // Offline or mid-deploy. Staying un-blocked is the safe default here:
      // the server refuses the actions anyway, so a missed gate costs a
      // confusing 403 rather than anything getting through.
    }
  }, []);

  const poll = useCallback(async (pollToken: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setPhase("awaiting");
    setError("");

    const deadline = Date.now() + POLL_DEADLINE_MS;
    try {
      while (Date.now() < deadline) {
        const res = await fetch(`/api/auth/bankid/${pollToken}`);
        if (res.status === 404) break;
        const data = await res.json().catch(() => ({}));

        if (data.status === "VERIFIED") {
          sessionStorage.removeItem(TOKEN_KEY);
          // The session cookie still describes the old account state, and the
          // NextAuth token only refreshes every five minutes — so reload
          // rather than just hiding the gate, and let the server re-answer.
          window.location.reload();
          return;
        }
        if (
          data.status === "REJECTED" ||
          data.status === "FAILED" ||
          data.status === "CANCELLED"
        ) {
          sessionStorage.removeItem(TOKEN_KEY);
          setPhase("idle");
          setError(data.message || "BankID kunde inte kopplas.");
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      sessionStorage.removeItem(TOKEN_KEY);
      setPhase("idle");
      setError("Det tog för lång tid. Försök igen.");
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // No reset on sign-out: `blocked` is only consulted while authenticated
    // (see the render guard), so clearing it here would be derived state kept
    // in a useState — which is the thing react-hooks/set-state-in-effect exists
    // to catch, and it is right to.
    if (status !== "authenticated") return;
    refresh();
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      pending = null;
    }
    if (pending) poll(pending);
  }, [status, refresh, poll]);

  async function startLink() {
    setError("");
    setPhase("starting");
    try {
      const res = await fetch("/api/auth/bankid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "link" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "BankID kunde inte startas.");
      sessionStorage.setItem(TOKEN_KEY, data.pollToken);
      window.location.href = data.redirectUrl;
    } catch (err) {
      setPhase("idle");
      setError((err as Error).message);
    }
  }

  // The login page is the one place this must never appear: a user who just
  // logged out lands there, and a modal telling them to link an account they no
  // longer hold would be a dead end.
  if (status !== "authenticated" || !blocked) return null;
  if (router.pathname === "/login") return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,20,60,0.85)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-md w-full rounded-3xl bg-white shadow-2xl p-8 space-y-5">
        <h2 className="text-xl font-bold" style={{ color: DARK_BLUE }}>
          Koppla ditt BankID
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Vi har gått över till BankID. Koppla ditt BankID till kontot så
          behåller du dina förslag, röster och ditt medlemskap. Utan BankID kan
          du fortfarande läsa allt i appen, men inte rösta eller kommentera.
        </p>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={startLink}
          disabled={phase !== "idle"}
          className="w-full font-bold py-3.5 rounded-xl text-base disabled:opacity-40"
          style={{ backgroundColor: AMBER, color: DARK_BLUE }}
        >
          {phase === "starting"
            ? "Startar BankID…"
            : phase === "awaiting"
              ? "Väntar på BankID…"
              : "Koppla BankID"}
        </button>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full font-medium py-2 text-sm text-gray-500 underline"
        >
          Fortsätt utan konto
        </button>
      </div>
    </div>
  );
}
