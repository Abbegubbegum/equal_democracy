import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  Landmark,
  PieChart,
  Radio,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Users,
  ChevronRight,
} from "lucide-react";
import { useConfig } from "../../lib/contexts/ConfigContext";

const slug = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ /g, "-");

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

const byNewest = (getDate) => (a, b) =>
  new Date(getDate(b) || 0).getTime() - new Date(getDate(a) || 0).getTime();

const TABS = [
  { key: "hem", label: "Hem", Icon: Home },
  { key: "fullmaktige", label: "Fullmäktige", Icon: Landmark },
  { key: "budget", label: "Budget", Icon: PieChart },
  { key: "livesessioner", label: "Livesessioner", Icon: Radio },
];

export default function ArchivePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { theme } = useConfig();

  const [tab, setTab] = useState("hem");
  const [proposals, setProposals] = useState([]);
  const [municipal, setMunicipal] = useState([]);
  const [budget, setBudget] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const [pRes, mRes, bRes, sRes] = await Promise.all([
          fetch("/api/citizen-proposals?status=all"),
          fetch("/api/municipal/sessions"),
          fetch("/api/budget/sessions"),
          fetch("/api/sessions/archived"),
        ]);
        const p = await pRes.json();
        setProposals(p.proposals || []);
        const m = await mRes.json();
        setMunicipal(
          (m.sessions || [])
            .filter((s) => s.status !== "draft")
            .sort(byNewest((s) => s.meetingDate)),
        );
        const b = await bRes.json();
        setBudget(
          (b.sessions || [])
            .filter((s) => s.status !== "draft")
            .sort(byNewest((s) => s.endDate || s.createdAt)),
        );
        const s = await sRes.json();
        setSessions(
          (Array.isArray(s) ? s : []).sort(
            byNewest((x) => x.endDate || x.createdAt),
          ),
        );
      } catch (error) {
        console.error("Error fetching archives:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center">
        <div className="text-xl text-gray-500">Laddar…</div>
      </div>
    );
  }

  const primaryColor = theme?.colors?.primary?.[600] || "#002d75";
  const primaryDark = theme?.colors?.primary?.[800] || "#001c55";

  const approved = proposals
    .filter((p) => p.fullmaktigeOutcome === "approved")
    .sort(byNewest((p) => p.fullmaktigeDecisionAt));
  const rejected = proposals
    .filter((p) => p.fullmaktigeOutcome === "rejected")
    .sort(byNewest((p) => p.fullmaktigeDecisionAt));

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header
        className="text-white px-4 sm:px-6 pt-5 pb-8 shadow-lg"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/app-icon-tight.svg"
                alt=""
                className="h-9 w-auto shrink-0"
              />
              <div className="leading-none">
                <div className="text-base font-black tracking-widest text-white">
                  VALLENTUNA
                </div>
                <div className="text-xs font-extrabold text-white mt-0.5">
                  Framåt
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-accent-400 text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Till startsidan
            </button>
          </div>
          <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight">
            Arkivet
          </h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base">
            Resultat av det vi röstat fram – och kommunens beslut.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-3">
          Arkiv
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-7">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`bg-white rounded-card border px-1 py-4 text-center transition-all duration-100 hover:-translate-y-0.5 ${
                  active
                    ? "border-accent-400 shadow-[0_10px_24px_-16px_rgba(245,166,35,0.6)]"
                    : "border-black/5 shadow-[0_8px_20px_-16px_rgba(0,20,64,0.4)]"
                }`}
              >
                <div className="h-8 flex items-center justify-center">
                  <Icon
                    className={`w-6 h-6 sm:w-7 sm:h-7 ${
                      active ? "text-accent-500" : "text-primary-600"
                    }`}
                    strokeWidth={1.75}
                  />
                </div>
                <div className="font-bold text-xs sm:text-sm text-gray-800 mt-1.5">
                  {label}
                </div>
              </button>
            );
          })}
        </div>

        {tab === "hem" && <HemTab approved={approved} rejected={rejected} />}
        {tab === "fullmaktige" && <FullmaktigeTab meetings={municipal} />}
        {tab === "budget" && <BudgetTab sessions={budget} />}
        {tab === "livesessioner" && <LiveTab sessions={sessions} />}
      </main>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="bg-white rounded-card border border-black/5 p-10 text-center text-gray-500 text-sm">
      {text}
    </div>
  );
}

function OutcomeCard({ p, approved }) {
  return (
    <div
      className={`bg-white rounded-card border border-black/5 shadow-[0_8px_22px_-18px_rgba(0,20,64,0.4)] p-4 flex gap-3.5 border-l-4 ${
        approved ? "border-l-green-500" : "border-l-red-500"
      }`}
    >
      {approved ? (
        <ThumbsUp
          className="w-9 h-9 text-green-500 shrink-0"
          strokeWidth={1.75}
        />
      ) : (
        <ThumbsDown
          className="w-9 h-9 text-red-500 shrink-0"
          strokeWidth={1.75}
        />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-gray-800">{p.title}</h3>
        <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
          {p.description}
        </p>
        <div className="text-xs text-gray-400 mt-1.5">
          {p.fullmaktigeDecisionAt &&
            `Beslut ${fmtDate(p.fullmaktigeDecisionAt)}`}
          {p.averageRating > 0 && (
            <span className="text-accent-500">
              {p.fullmaktigeDecisionAt ? " · " : ""}★{" "}
              {p.averageRating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function HemTab({ approved, rejected }) {
  if (approved.length === 0 && rejected.length === 0)
    return <Empty text="Inga förslag har behandlats av fullmäktige än." />;
  return (
    <div className="space-y-6">
      {approved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-base font-extrabold text-gray-800 mb-3">
            <span className="text-[0.66rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              Godkända
            </span>
            av fullmäktige
          </div>
          <div className="space-y-3">
            {approved.map((p) => (
              <OutcomeCard key={p._id} p={p} approved />
            ))}
          </div>
        </div>
      )}
      {rejected.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-base font-extrabold text-gray-800 mb-3">
            <span className="text-[0.66rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Avslagna
            </span>
            av fullmäktige
          </div>
          <div className="space-y-3">
            {rejected.map((p) => (
              <OutcomeCard key={p._id} p={p} approved={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FullmaktigeTab({ meetings }) {
  if (meetings.length === 0)
    return <Empty text="Inga arkiverade kommunmöten än." />;
  return (
    <div className="space-y-3">
      {meetings.map((m) => {
        const closed = (m.items || []).filter(
          (i) => i.status === "closed",
        ).length;
        return (
          <Link
            key={m._id}
            href={`/${slug(m.municipality)}/${slug(m.meetingType)}/archive`}
            className="block bg-white rounded-card border border-black/5 shadow-[0_8px_22px_-18px_rgba(0,20,64,0.4)] p-4 hover:shadow-[0_14px_30px_-18px_rgba(0,20,64,0.5)] transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-800">{m.name}</h3>
                <p className="text-sm text-gray-500">
                  {m.meetingType} · {m.municipality}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {fmtDate(m.meetingDate)}
              </span>
              <span>{closed} avslutade ärenden</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function BudgetTab({ sessions }) {
  if (sessions.length === 0)
    return <Empty text="Inga arkiverade budgetsessioner än." />;
  return (
    <div className="space-y-3">
      {sessions.map((b) => (
        <Link
          key={b._id}
          href={`/budget/results/${b.sessionId}`}
          className="block bg-white rounded-card border border-black/5 shadow-[0_8px_22px_-18px_rgba(0,20,64,0.4)] p-4 hover:shadow-[0_14px_30px_-18px_rgba(0,20,64,0.5)] transition-shadow"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800">{b.name}</h3>
              <p className="text-sm text-gray-500">{b.municipality}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            {b.endDate ? fmtDate(b.endDate) : "Avslutad"}
          </div>
        </Link>
      ))}
    </div>
  );
}

function LiveTab({ sessions }) {
  if (sessions.length === 0)
    return <Empty text="Inga arkiverade livesessioner än." />;
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <Link
          key={s._id}
          href={`/archive/${s._id}`}
          className="block bg-white rounded-card border border-black/5 shadow-[0_8px_22px_-18px_rgba(0,20,64,0.4)] p-4 hover:shadow-[0_14px_30px_-18px_rgba(0,20,64,0.5)] transition-shadow"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-gray-800 min-w-0">{s.title}</h3>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            {s.participantCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {s.participantCount} deltagare
              </span>
            )}
            {s.endDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {fmtDate(s.endDate)}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
