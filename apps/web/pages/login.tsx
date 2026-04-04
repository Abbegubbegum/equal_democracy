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
			if (!res.ok)
				throw new Error(data.message || t("login.couldNotSendCode"));
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
			if (!res.ok)
				throw new Error(data.message || t("login.couldNotSendCode"));
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

	return (
		<div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(to bottom right, #002d75, #001c55)" }}>
			<div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6">
				<div className="text-center space-y-2">
				<div className="flex flex-row items-center justify-center gap-3">
					<div className="w-20 h-20 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#f8b60e" }}>
						<ChevronsRight className="w-14 h-14" strokeWidth={3} style={{ color: "#001c55" }} />
					</div>
					<h1 className="text-left" style={{ color: "#001c55" }}>
						<div className="text-3xl font-black tracking-widest leading-tight">VALLENTUNA</div>
						<div className="text-xl font-medium -mt-1">Framåt</div>
					</h1>
				</div>
					<p className="text-lg text-gray-600">
						{t("login.subtitle")}
					</p>
				</div>

				{step === "email" && (
					<form onSubmit={requestCode} className="space-y-4">
						{error && (
							<div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
								{error}
							</div>
						)}
						{info && (
							<div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-green-700 text-sm">
								{info}
							</div>
						)}

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("login.email")}
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#002d75] focus:outline-none text-lg"
								placeholder={t("login.emailPlaceholder")}
								required
								autoFocus
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg" style={{ backgroundColor: "#002d75" }} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#001c55"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="#002d75"}
						>
							{loading ? t("login.sending") : t("login.sendCode")}
						</button>
					</form>
				)}

				{step === "code" && (
					<form onSubmit={verifyCode} className="space-y-4">
						{error && (
							<div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
								{error}
							</div>
						)}

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("login.code")}
							</label>
							<input
								inputMode="numeric"
								pattern="\d{6}"
								maxLength={6}
								value={code}
								onChange={(e) =>
									setCode(e.target.value.replace(/\D/g, ""))
								}
								className="w-full tracking-widest text-center text-2xl px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#002d75] focus:outline-none"
								placeholder="••••••"
								required
								autoFocus
							/>
							<p className="text-xs text-gray-500 mt-2">
								{t("login.codeSentTo")}{" "}
								<span className="font-medium">{email}</span>
							</p>
						</div>

						<button
							type="submit"
							disabled={loading || code.length !== 6}
							className="w-full disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg" style={{ backgroundColor: "#002d75" }} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#001c55"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="#002d75"}
						>
							{loading ? t("login.verifying") : t("login.login")}
						</button>

						<button
							type="button"
							onClick={resendCode}
							disabled={loading || resendCooldown > 0}
							className="w-full font-medium disabled:text-gray-400" style={resendCooldown > 0 ? {} : { color: "#002d75" }}
						>
							{resendCooldown > 0
								? t("login.resendIn").replace("{seconds}", String(resendCooldown))
								: t("login.resendCode")}
						</button>

						<button
							type="button"
							onClick={() => setStep("email")}
							className="w-full font-medium" style={{ color: "#002d75" }}
						>
							{t("login.changeEmail")}
						</button>
					</form>
				)}

				<div className="text-center space-y-3">
					<Link
						href="/about"
						className="inline-flex items-center gap-2 font-medium" style={{ color: "#002d75" }}
					>
						<Info className="w-4 h-4" /> {t("login.aboutLink")}
					</Link>
				</div>
			</div>
		</div>
	);
}
