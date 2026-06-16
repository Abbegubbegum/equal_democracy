import Link from "next/link";
import { Mail, MessageCircle, FileText, ChevronDown } from "lucide-react";
import { useState } from "react";

const BLUE = "#002d75";
const DARK_BLUE = "#001c55";
const YELLOW = "#f5a623";

const FAQS = [
  {
    q: "Hur loggar jag in?",
    a: "Du loggar in med din e-postadress. Vi skickar en engangskod till din inkorg som du anger i appen. Inget losenord behovs.",
  },
  {
    q: "Vem kan anvanda appen?",
    a: "Appen ar oppna for alla som vill foljamed i Vallentuna Framats arbete. For att rosta och lamna forslag behover du vara registrerad anvandare.",
  },
  {
    q: "Hur raderar jag mitt konto?",
    a: "Du kan radera ditt konto och all din data via vallentuna.app/radera. All personlig information tas bort permanent.",
  },
  {
    q: "Jag fick ingen inloggningskod. Vad gor jag?",
    a: "Kontrollera skrapposten i din e-post. Om koden fortfarande saknas kan du begara en ny kod i appen. Koden galler i 10 minuter.",
  },
  {
    q: "Hur lamnar jag ett medborgarforslag?",
    a: "Oppna fliken Forslag i appen och tryck pa plusknappen. Du kan skriva en titel, beskrivning och lagga till en bild.",
  },
  {
    q: "Vad hander med mina roster?",
    a: "Dina roster lagras anonymt i var databas och anvands for att rakna samman resultatet. Vi säljer aldrig din data till tredje part.",
  },
];

export default function SupportPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(to bottom right, ${BLUE}, ${DARK_BLUE})`,
        padding: "3rem 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: YELLOW,
              marginBottom: "1rem",
            }}
          >
            <MessageCircle size={26} color={BLUE} />
          </div>
          <h1
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
              margin: "0 0 0.5rem",
            }}
          >
            Support
          </h1>
          <p
            style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, margin: 0 }}
          >
            Vallentuna Framat
          </p>
        </div>

        {/* Contact card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "1.5rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: "0.75rem",
            }}
          >
            <Mail size={20} color={BLUE} />
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#111",
                margin: 0,
              }}
            >
              Kontakta oss
            </h2>
          </div>
          <p style={{ color: "#555", lineHeight: 1.6, margin: "0 0 1rem" }}>
            Har du fragor, tekniska problem eller vill ge feedback? Hör av dig
            till oss via e-post sa svarar vi inom 2 vardagar.
          </p>
          <a
            href="mailto:kontakt@vallentunaframat.se"
            style={{
              display: "inline-block",
              padding: "0.7rem 1.5rem",
              background: BLUE,
              color: "#fff",
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: "none",
              fontSize: 15,
            }}
          >
            kontakt@vallentunaframat.se
          </a>
        </div>

        {/* FAQ */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ padding: "1.25rem 1.5rem 0.75rem" }}>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#111",
                margin: 0,
              }}
            >
              Vanliga fragor
            </h2>
          </div>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{
                borderTop: "1px solid #f0f0f0",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 1.5rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "#222",
                    fontSize: 15,
                    flex: 1,
                  }}
                >
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  color="#aaa"
                  style={{
                    transform: open === i ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                  }}
                />
              </button>
              {open === i && (
                <p
                  style={{
                    padding: "0 1.5rem 1rem",
                    color: "#555",
                    lineHeight: 1.6,
                    margin: 0,
                    fontSize: 15,
                  }}
                >
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Legal link */}
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <FileText size={18} color="rgba(255,255,255,0.6)" />
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 13,
                margin: "0 0 0.25rem",
              }}
            >
              Juridisk information
            </p>
            <Link
              href="/legal"
              style={{
                color: YELLOW,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Integritetspolicy och Anvandarvillkor
            </Link>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.3)",
            fontSize: 12,
            marginTop: "2rem",
          }}
        >
          Vallentuna Framat, org.nr 802555-8852
        </p>
      </div>
    </div>
  );
}
