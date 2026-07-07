import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Trash2, ChevronLeft, CheckCircle, AlertTriangle } from "lucide-react";

type Step = "info" | "confirm" | "done";

const BLUE = "#002d75";
const DARK_BLUE = "#001c55";

export default function RaderaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const userEmail = session?.user?.email ?? "";
  const emailMatch =
    emailInput.trim().toLowerCase() === userEmail.toLowerCase();

  async function handleDelete() {
    if (!emailMatch) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Misslyckades");
      setStep("done");
      setTimeout(() => signOut({ callbackUrl: "/login" }), 3000);
    } catch {
      setError("Något gick fel. Försök igen eller kontakta oss.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(to bottom right, ${BLUE}, ${DARK_BLUE})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 18 }}>
          Laddar...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(to bottom right, ${BLUE}, ${DARK_BLUE})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      {step === "info" && (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
              }}
            >
              <Trash2 size={26} color="#ef4444" />
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#111",
                marginBottom: 8,
              }}
            >
              Radera ditt konto
            </h1>
            <p style={{ color: "#555", lineHeight: 1.6 }}>
              Vi respekterar din rätt att lämna. Om du vill radera ditt konto
              och all din data kan du göra det här.
            </p>
          </div>

          <div
            style={{
              background: "#fef9f0",
              border: "1px solid #fcd34d",
              borderRadius: 10,
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <p
              style={{
                fontWeight: 600,
                color: "#92400e",
                marginBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertTriangle size={16} />
              Det här tas bort permanent
            </p>
            <ul
              style={{
                color: "#78350f",
                paddingLeft: "1.25rem",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              <li>Ditt konto och din profil</li>
              <li>Dina förslag och kommentarer</li>
              <li>Dina röster och betyg</li>
              <li>Dina inskickade förslag och bilder</li>
              <li>Dina budgetröster</li>
            </ul>
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#888",
              textAlign: "center",
              marginBottom: "1.5rem",
            }}
          >
            Anonymiserade sammanställningar av omröstningar påverkas inte —
            enbart din personliga koppling till dem tas bort.
          </p>

          {!session ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#555", marginBottom: "1rem" }}>
                Du behöver vara inloggad för att radera ditt konto.
              </p>
              <Link
                href="/login"
                style={{
                  display: "inline-block",
                  padding: "0.75rem 2rem",
                  background: BLUE,
                  color: "#fff",
                  borderRadius: 8,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Logga in
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => setStep("confirm")}
                style={{
                  padding: "0.85rem",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Fortsätt med radering
              </button>
              <Link
                href="/"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "0.85rem",
                  background: "#f3f4f6",
                  color: "#374151",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                Avbryt — jag vill inte radera
              </Link>
            </div>
          )}
        </div>
      )}

      {step === "confirm" && (
        <div style={cardStyle}>
          <button
            onClick={() => {
              setStep("info");
              setEmailInput("");
              setError("");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              color: "#555",
              cursor: "pointer",
              fontSize: 14,
              marginBottom: "1.25rem",
              padding: 0,
            }}
          >
            <ChevronLeft size={16} />
            Tillbaka
          </button>

          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#111",
              marginBottom: 8,
            }}
          >
            Bekräfta radering
          </h2>
          <p
            style={{ color: "#555", marginBottom: "1.25rem", lineHeight: 1.6 }}
          >
            Skriv in din e-postadress för att bekräfta att du vill radera ditt
            konto och all din data. Det går <strong>inte att ångra</strong>{" "}
            detta.
          </p>

          <label
            style={{
              display: "block",
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
              fontSize: 14,
            }}
          >
            Din e-postadress
          </label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              setError("");
            }}
            placeholder={userEmail}
            autoComplete="off"
            style={{
              width: "100%",
              padding: "0.75rem",
              border: `2px solid ${emailInput && !emailMatch ? "#ef4444" : "#d1d5db"}`,
              borderRadius: 8,
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "1.25rem",
              transition: "border-color 0.15s",
            }}
          />

          {error && (
            <p style={{ color: "#ef4444", fontSize: 14, marginBottom: "1rem" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleDelete}
            disabled={!emailMatch || loading}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: emailMatch ? "#ef4444" : "#d1d5db",
              color: emailMatch ? "#fff" : "#9ca3af",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 16,
              cursor: emailMatch ? "pointer" : "not-allowed",
              marginBottom: 10,
              transition: "background 0.15s",
            }}
          >
            {loading ? "Raderar..." : "Ja, radera mitt konto permanent"}
          </button>

          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: "#f3f4f6",
              color: "#374151",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Avbryt
          </button>
        </div>
      )}

      {step === "done" && (
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(34,197,94,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
            }}
          >
            <CheckCircle size={32} color="#22c55e" />
          </div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#111",
              marginBottom: 8,
            }}
          >
            Ditt konto är raderat
          </h2>
          <p style={{ color: "#555", lineHeight: 1.7, marginBottom: "1.5rem" }}>
            Tack för att du var med och bidrog till en mer deltagande demokrati.
            All din data har nu tagits bort. Du loggas ut automatiskt om ett
            ögonblick.
          </p>
          <p style={{ fontSize: 13, color: "#aaa" }}>Omdirigerar...</p>
        </div>
      )}

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link
          href="/legal"
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
            textDecoration: "underline",
          }}
        >
          Integritetspolicy
        </Link>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  borderRadius: 16,
  padding: "2rem",
  width: "100%",
  maxWidth: 440,
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
};
