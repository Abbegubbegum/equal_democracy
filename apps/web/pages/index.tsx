import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import {
  Home,
  CheckCircle,
  Lightbulb,
  Archive,
  Info,
  PieChart,
  Radio,
} from "lucide-react";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";

const STORAGE_SELECTED_QUESTION = "vf_selected_question";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, config } = useConfig();
  const featureSlot = config?.featureSlot || "info";
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [liveSessionId, setLiveSessionId] = useState(null);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/questions");
      if (res.ok) {
        const data = await res.json();
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  // No redirect to /login. The front page is readable signed out — the
  // questions, the tallies and the activity feed are the point of it — and the
  // API answers anonymously. Only acting needs an account.
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // When the activity slot is set to "livesession", resolve the current active
  // session so the tile can deep-link straight to it.
  useEffect(() => {
    if (featureSlot !== "livesession") return;
    (async () => {
      try {
        const res = await fetch("/api/sessions/active");
        if (res.ok) {
          const data = await res.json();
          const first = Array.isArray(data) ? data[0] : null;
          if (first?._id) setLiveSessionId(first._id);
        }
      } catch {
        /* fall back to /vallentuna */
      }
    })();
  }, [featureSlot]);

  // Two-step flow (mirrors mobile Hem→Rösta): pick a question here, store the
  // choice, then go to Rösta to debate + vote.
  const selectQuestion = (id) => {
    try {
      localStorage.setItem(STORAGE_SELECTED_QUESTION, id);
    } catch {
      /* ignore */
    }
    router.push("/rosta");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Laddar...</div>
      </div>
    );
  }

  // Get theme colors
  const primaryColor = theme.colors.primary[600] || "#002d75";
  const primaryDark = theme.colors.primary[800] || "#001c55";

  // Quick-nav: three fixed tiles + the swappable activity slot (Settings.featureSlot)
  const SLOT_TILES = {
    info: { Icon: Info, label: "Info", href: "/about" },
    budget: { Icon: PieChart, label: "Budget", href: "/budget" },
    arkiv: { Icon: Archive, label: "Arkiv", href: "/archive" },
    livesession: {
      Icon: Radio,
      label: "Live",
      href: liveSessionId ? `/session/${liveSessionId}` : "/vallentuna",
    },
  };
  const quickTiles = [
    { Icon: Home, label: "Hem", href: "/" },
    { Icon: CheckCircle, label: "Rösta", href: "/rosta" },
    { Icon: Lightbulb, label: "Förslag", href: "/medborgarforslag" },
    SLOT_TILES[featureSlot] || SLOT_TILES.info,
  ];

  // Hem feed: active questions the user hasn't voted on yet (already-voted hidden).
  const feedQuestions = questions.filter((q) => !q.userVote);

  return (
    <div className="min-h-screen bg-[#f7f8fb] overflow-x-hidden">
      {/* Header */}
      <div
        className="text-white p-4 sm:p-6 shadow-lg"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <button
              onClick={() => router.push("/about")}
              className="flex flex-row items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              title="Om Vallentuna Framåt"
            >
              <img
                src="/app-icon-tight.svg"
                alt=""
                className="h-14 sm:h-16 w-auto shrink-0"
              />
              <div className="text-left">
                <div className="text-2xl sm:text-3xl font-black tracking-widest leading-none text-white">
                  VALLENTUNA
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-white mt-1">
                  Framåt
                </div>
              </div>
            </button>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
              {session?.user?.isSuperAdmin && (
                <>
                  <button
                    onClick={() => router.push("/admin")}
                    className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
                  >
                    {t("nav.admin")}
                  </button>
                  <button
                    onClick={() => router.push("/manage-content")}
                    className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
                  >
                    Hantera innehåll
                  </button>
                </>
              )}
              {session?.user?.isAdmin && !session?.user?.isSuperAdmin && (
                <>
                  <button
                    onClick={() => router.push("/manage-content")}
                    className="text-white hover:text-accent-400 font-medium whitespace-nowrap"
                  >
                    Hantera innehåll
                  </button>
                </>
              )}
              {/* An anonymous visitor reaches this header too, now that the
                  front page renders signed out — so it has to offer the way in
                  rather than a way out of a session that does not exist. */}
              {session ? (
                <button
                  onClick={() => signOut()}
                  className="text-white hover:text-accent-400 whitespace-nowrap"
                >
                  {t("auth.logout")}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="text-white hover:text-accent-400 font-semibold whitespace-nowrap"
                >
                  Logga in
                </Link>
              )}
            </div>
          </div>
          <p className="text-white/90 text-sm sm:text-base mt-4">
            {session ? (
              <>
                Hej{" "}
                <span className="font-bold text-white">
                  {session.user?.name}
                </span>{" "}
                – välkommen att påverka Vallentuna!
              </>
            ) : (
              "Välkommen att påverka Vallentuna — läs fritt, logga in med BankID för att delta."
            )}
          </p>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-3">
          Utforska
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {quickTiles.map((tile, i) => {
            const TileIcon = tile.Icon;
            return (
              <button
                key={`${tile.href}-${i}`}
                onClick={() => router.push(tile.href)}
                className="group bg-white rounded-card border border-black/5 shadow-[0_8px_20px_-16px_rgba(0,20,64,0.4)] px-1 py-4 text-center transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-18px_rgba(0,20,64,0.45)]"
              >
                <div className="h-8 flex items-center justify-center">
                  <TileIcon
                    className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="font-bold text-xs sm:text-sm text-gray-800 mt-1.5">
                  {tile.label}
                </div>
                <div className="h-[3px] w-6 mx-auto mt-1.5 rounded bg-accent-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Frågor feed (Hem) */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-12">
        <div className="flex items-baseline justify-between mb-4 gap-3">
          <h2 className="text-lg sm:text-xl font-black text-gray-800">
            Frågor att rösta på
          </h2>
        </div>

        {questionsLoading ? (
          <div className="text-center py-12 text-gray-500">Laddar frågor…</div>
        ) : feedQuestions.length === 0 ? (
          <div className="bg-white rounded-card border border-black/5 p-10 text-center">
            <p className="text-gray-700 font-semibold mb-1">Du är à jour! 🎉</p>
            <p className="text-gray-500 text-sm">
              Inga fler frågor att rösta på just nu.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                onSelect={() => selectQuestion(q.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ q, onSelect }) {
  const totalVotes = (q.voteCounts?.ja || 0) + (q.voteCounts?.nej || 0);
  const deadline = q.deadline
    ? new Date(q.deadline).toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="relative flex flex-col justify-end rounded-[20px] overflow-hidden min-h-[250px] shadow-[0_14px_32px_-20px_rgba(0,20,64,0.6)]">
      {q.imageUrl ? (
        <img
          src={q.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

      <span className="absolute top-3.5 left-3.5 z-10 text-[0.64rem] font-extrabold uppercase tracking-[0.12em] text-white bg-black/40 border border-white/25 rounded-full px-2.5 py-1 backdrop-blur-sm">
        Röstning
      </span>

      <div className="relative z-[1] p-4 sm:p-5 text-white">
        {q.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {q.categories.map((cat) => (
              <span
                key={cat}
                className="text-[0.68rem] font-semibold bg-white/20 text-white rounded-full px-2.5 py-0.5 backdrop-blur-sm"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
        <p className="text-xl sm:text-2xl font-extrabold leading-tight drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
          {q.text}
        </p>
        {(deadline || totalVotes > 0) && (
          <p className="text-sm text-white/80 mt-2">
            {deadline && `Stänger ${deadline}`}
            {deadline && totalVotes > 0 && " · "}
            {totalVotes > 0 && `${totalVotes} har röstat`}
          </p>
        )}
        <button
          onClick={onSelect}
          className="block w-full mt-3.5 bg-accent-400 text-primary-800 font-extrabold text-base py-3 rounded-btn hover:bg-accent-500 transition-colors"
        >
          Välj
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// APPLY ADMIN VIEW
// ============================================================================
