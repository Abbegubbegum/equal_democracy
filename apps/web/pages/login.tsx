import React, { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChevronsRight, Info } from "lucide-react";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";

const RESEND_COOLDOWN = 60;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  useConfig();
  const [step, setStep] = useState("email"); // 'email' | 'code'
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown(seconds = RESEND_COOLDOWN) {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setResendCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("login.couldNotSendCode"));
      setInfo(t("login.codeSent"));
      if (!data.alreadySent) startCooldown();
      setStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("login.couldNotSendCode"));
      setInfo(t("login.codeSent"));
      startCooldown();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        code,
        redirect: false,
      });
      if (result?.error) throw new Error(result.error);
      router.push("/");
    } catch (err) {
      setError(err.message || t("login.loginError"));
    } finally {
      setLoading(false);
    }
  }

  const AMBER = "#f5a623";
  const BLUE = "#002d75";
  const DARK_BLUE = "#001c55";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: `linear-gradient(to bottom right, ${BLUE}, ${DARK_BLUE})`,
      }}
    >
      {/* Logo */}
      <div className="flex flex-row items-center justify-center gap-3 mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: AMBER }}
        >
          <ChevronsRight
            className="w-11 h-11"
            strokeWidth={3}
            style={{ color: DARK_BLUE }}
          />
        </div>
        <div className="text-left text-white">
          <div className="text-3xl font-black tracking-widest leading-tight">
            VALLENTUNA
          </div>
          <div className="text-xl font-medium -mt-1">Framåt</div>
        </div>
      </div>

      {/* Card */}
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
          {t("login.subtitle")}
        </p>

        {step === "email" && (
          <form onSubmit={requestCode} className="space-y-4">
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
            {info && (
              <div
                className="rounded-xl p-3 text-sm"
                style={{
                  backgroundColor: "rgba(34,197,94,0.15)",
                  color: "#86efac",
                  border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                {info}
              </div>
            )}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "rgba(255,255,255,0.8)" }}
              >
                {t("login.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-lg focus:outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                }}
                placeholder={t("login.emailPlaceholder")}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-4 rounded-xl text-lg transition-opacity disabled:opacity-40"
              style={{ backgroundColor: AMBER, color: DARK_BLUE }}
            >
              {loading ? t("login.sending") : t("login.sendCode")}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="space-y-4">
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
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "rgba(255,255,255,0.8)" }}
              >
                {t("login.code")}
              </label>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full tracking-widest text-center text-2xl px-4 py-3 rounded-xl focus:outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                }}
                placeholder="••••••"
                required
                autoFocus
              />
              <p
                className="text-xs mt-2"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {t("login.codeSentTo")}{" "}
                <span className="font-medium text-white">{email}</span>
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full font-bold py-4 rounded-xl text-lg transition-opacity disabled:opacity-40"
              style={{ backgroundColor: AMBER, color: DARK_BLUE }}
            >
              {loading ? t("login.verifying") : t("login.login")}
            </button>
            <button
              type="button"
              onClick={resendCode}
              disabled={loading || resendCooldown > 0}
              className="w-full font-medium py-2"
              style={{
                color:
                  resendCooldown > 0
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(255,255,255,0.7)",
              }}
            >
              {resendCooldown > 0
                ? t("login.resendIn").replace(
                    "{seconds}",
                    String(resendCooldown),
                  )
                : t("login.resendCode")}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full font-medium py-2"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {t("login.changeEmail")}
            </button>
          </form>
        )}

        <div className="text-center space-y-3 pt-2">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 font-medium"
            style={{ color: AMBER }}
          >
            <Info className="w-4 h-4" /> {t("login.aboutLink")}
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
