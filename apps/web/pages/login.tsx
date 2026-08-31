import React, { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { Info } from "lucide-react";
import { useConfig } from "../lib/contexts/ConfigContext";

/**
 * BankID is the only way in.
 *
 * The email/OTP form that used to live here is gone. It could not lead anywhere
 * different — someone without BankID loses account access either way, and
 * someone with it ends up authenticating with BankID regardless — so it only
 * added a second door onto the same room, which read as a choice when it was
 * not one. The endpoints behind it are still alive for app builds that predate
 * this change (docs/bankid-login-plan.md §7.4).
 *
 * The flow, and why it is shaped like this:
 *
 *   1. POST /api/auth/bankid          → { pollToken, redirectUrl }
 *   2. the browser leaves for GrandID's hosted page
 *   3. GrandID sends it back to /login
 *   4. we poll GET /api/auth/bankid/[pollToken] until it settles
 *   5. on VERIFIED, signIn("bankid", { pollToken }) establishes the session
 *
 * The outcome never comes back through the redirect — only the browser does.
 * `pollToken` is kept in sessionStorage across step 2, because the page unloads
 * entirely; it is a bearer secret, so sessionStorage (this tab, this origin,
 * cleared on close) rather than localStorage.
 */

const AMBER = "#f5a623";
const BLUE = "#002d75";
const DARK_BLUE = "#001c55";

const TOKEN_KEY = "bankid_login_poll_token";
/** GrandID's own floor is one GetSession every 2s, enforced server-side too. */
const POLL_INTERVAL_MS = 2000;
/** A BankID order lives about 3 minutes; give the round trip a little more. */
const POLL_DEADLINE_MS = 4 * 60 * 1000;

type Phase = "idle" | "starting" | "awaiting" | "finishing";

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the flow just cannot resume, which is survivable */
  }
}

export default function LoginPage() {
  const router = useRouter();
  useConfig();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pollingRef = useRef(false);

  const finish = useCallback(
    async (pollToken: string) => {
      setPhase("finishing");
      const result = await signIn("bankid", { pollToken, redirect: false });
      clearToken();
      if (result?.error) {
        setPhase("idle");
        setError(result.error);
        return;
      }
      router.push("/");
    },
    [router],
  );

  /**
   * Polls until the order settles.
   *
   * Declared above the effect that calls it and wrapped in useCallback because
   * `react-hooks/immutability` is an error in this app — a hoisted function
   * called from an effect does not satisfy it, the rule works on lexical order.
   */
  const poll = useCallback(
    async (pollToken: string) => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      setPhase("awaiting");
      setError("");

      const deadline = Date.now() + POLL_DEADLINE_MS;
      try {
        while (Date.now() < deadline) {
          const res = await fetch(`/api/auth/bankid/${pollToken}`);
          if (res.status === 404) {
            clearToken();
            setPhase("idle");
            setError("Inloggningen har gått ut. Försök igen.");
            return;
          }
          const data = await res.json().catch(() => ({}));

          if (data.status === "VERIFIED") {
            await finish(pollToken);
            return;
          }
          if (
            data.status === "REJECTED" ||
            data.status === "FAILED" ||
            data.status === "CANCELLED"
          ) {
            clearToken();
            setPhase("idle");
            setError(data.message || "Inloggningen kunde inte slutföras.");
            return;
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }

        clearToken();
        setPhase("idle");
        setError("Inloggningen tog för lång tid. Försök igen.");
      } finally {
        pollingRef.current = false;
      }
    },
    [finish],
  );

  // Coming back from GrandID: the page was unloaded, so the only thing that
  // survives is the token we parked. Its presence is what says "resume".
  useEffect(() => {
    const pending = readToken();
    if (pending) {
      setNotice("Kontrollerar din inloggning…");
      poll(pending);
    }
  }, [poll]);

  async function startBankId() {
    setError("");
    setNotice("");
    setPhase("starting");
    try {
      const res = await fetch("/api/auth/bankid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "login" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "BankID kunde inte startas.");
      }

      try {
        sessionStorage.setItem(TOKEN_KEY, data.pollToken);
      } catch {
        // Without somewhere to park the token the return trip cannot resume, so
        // say so now rather than after the user has signed for nothing.
        throw new Error(
          "Din webbläsare tillåter inte att inloggningen sparas. Stäng av privat läge och försök igen.",
        );
      }

      window.location.href = data.redirectUrl;
    } catch (err) {
      setPhase("idle");
      setError((err as Error).message);
    }
  }

  const busy = phase !== "idle";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: `linear-gradient(to bottom right, ${BLUE}, ${DARK_BLUE})`,
      }}
    >
      <div className="flex flex-row items-center justify-center gap-3 mb-8">
        <Image
          src="/app-icon-transparent.svg"
          alt="Vallentuna Framåt"
          width={72}
          height={72}
        />
        <div className="text-left text-white">
          <div className="text-3xl font-black tracking-widest leading-tight">
            VALLENTUNA
          </div>
          <div className="text-xl font-medium -mt-1">Framåt</div>
        </div>
      </div>

      <div
        className="max-w-md w-full rounded-3xl shadow-2xl p-8 space-y-6"
        style={{
          backgroundColor: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <p
          className="text-center"
          style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}
        >
          Logga in med BankID för att rösta, kommentera och lämna förslag.
        </p>

        {error && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{
              backgroundColor: "rgba(239,68,68,0.15)",
              color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            {error}
          </div>
        )}
        {notice && !error && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{
              backgroundColor: "rgba(34,197,94,0.15)",
              color: "#86efac",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            {notice}
          </div>
        )}

        <button
          type="button"
          onClick={startBankId}
          disabled={busy}
          className="w-full font-bold py-4 rounded-xl text-lg transition-opacity disabled:opacity-40"
          style={{ backgroundColor: AMBER, color: DARK_BLUE }}
        >
          {phase === "starting"
            ? "Startar BankID…"
            : phase === "awaiting"
              ? "Väntar på BankID…"
              : phase === "finishing"
                ? "Loggar in…"
                : "Logga in med BankID"}
        </button>

        <p
          className="text-center text-xs"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Du kan läsa hela appen utan att logga in.{" "}
          <Link href="/" className="underline">
            Fortsätt utan konto
          </Link>
        </p>

        <div className="text-center space-y-3 pt-2">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 font-medium"
            style={{ color: AMBER }}
          >
            <Info className="w-4 h-4" /> Om Vallentuna Framåt
          </Link>
          <div>
            <Link
              href="/legal"
              className="text-xs underline"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Integritetspolicy &amp; Användarvillkor
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
