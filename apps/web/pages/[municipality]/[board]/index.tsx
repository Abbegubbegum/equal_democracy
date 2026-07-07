import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ArrowLeft, Archive } from "lucide-react";
import Link from "next/link";
import { fetchWithCsrf } from "../../../lib/fetch-with-csrf";
import { useConfig } from "../../../lib/contexts/ConfigContext";

export async function getServerSideProps({ params }) {
  const VALID_MUNICIPALITIES = ["vallentuna"];
  if (!VALID_MUNICIPALITIES.includes(params.municipality)) {
    return { notFound: true };
  }
  return { props: {} };
}

function ItemStarRating({ item, municipalSessionId, loggedIn }) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [aggregate, setAggregate] = useState({
    averageRating: item.averageRating || 0,
    ratingCount: item.ratingCount || 0,
  });

  async function submitRating(value) {
    if (!loggedIn) {
      alert("Du måste logga in för att betygsätta.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf("/api/municipal/items/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipalSessionId,
          itemId: item._id,
          rating: value,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRating(value);
        setAggregate({
          averageRating: data.averageRating,
          ratingCount: data.ratingCount,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-xs text-white/70">Betygsätt:</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={submitting}
            onClick={() => submitRating(n)}
            title={`Betygsätt ${n} av 5`}
            className={`text-lg leading-none hover:scale-110 transition-transform ${
              n <= rating ? "text-accent-400" : "text-white/35"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {aggregate.ratingCount > 0 && (
        <span className="text-xs text-white/80">
          ★ {aggregate.averageRating.toFixed(1)} ({aggregate.ratingCount})
        </span>
      )}
    </div>
  );
}

export default function BoardPage() {
  const router = useRouter();
  const { data: authSession } = useSession();
  const { theme } = useConfig();
  const { municipality: municipalityParam, board: boardParam } = router.query;
  const municipality = String(municipalityParam || "");
  const board = String(boardParam || "");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (municipality && board) {
      fetchActiveSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipality, board]);

  const fetchActiveSessions = async () => {
    try {
      const res = await fetch(
        `/api/municipal/board-sessions?municipality=${municipality}&board=${board}&status=active`,
      );
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!municipality || !board) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center">
        <div className="text-xl text-gray-500">Laddar…</div>
      </div>
    );
  }

  const primaryColor = theme?.colors?.primary?.[600] || "#002d75";
  const primaryDark = theme?.colors?.primary?.[800] || "#001c55";

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <header
        className="text-white px-4 sm:px-6 pt-5 pb-8 shadow-lg"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
        }}
      >
        <div className="max-w-2xl mx-auto">
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
              onClick={() => router.push(`/${municipality}`)}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-accent-400 text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Nämnder
            </button>
          </div>
          <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight capitalize">
            {board.replace(/-/g, " ")}
          </h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base capitalize">
            {municipality} kommun
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Sub-nav */}
        <div className="flex gap-2 mb-5">
          <span className="px-3.5 py-2 bg-primary-600 text-white text-sm font-bold rounded-btn">
            Aktiva frågor
          </span>
          <Link
            href={`/${municipality}/${board}/archive`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-black/5 text-gray-600 text-sm font-semibold rounded-btn hover:bg-[#fafbfe]"
          >
            <Archive className="w-4 h-4" />
            Arkiv
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Laddar…</div>
        ) : sessions.every(
            (s) => s.items.filter((i) => i.status === "active").length === 0,
          ) ? (
          <div className="bg-white rounded-card border border-black/5 p-10 text-center text-gray-500">
            Inga aktiva frågor för tillfället.
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((municipalSession) =>
              municipalSession.items
                .filter((item) => item.status === "active")
                .map((item) => {
                  const dateStr = new Date(
                    municipalSession.meetingDate,
                  ).toLocaleDateString("sv-SE", {
                    day: "numeric",
                    month: "long",
                  });
                  const timeStr = municipalSession.meetingTime || "18:00";

                  return (
                    <div
                      key={item._id}
                      className="relative flex flex-col justify-end rounded-[20px] overflow-hidden min-h-[260px] shadow-[0_14px_32px_-20px_rgba(0,20,64,0.6)]"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/40 to-black/10" />

                      <span className="absolute top-3.5 left-3.5 z-10 text-[0.66rem] font-bold text-white bg-black/40 border border-white/25 rounded-full px-2.5 py-1 backdrop-blur-sm">
                        Möte {dateStr} · {timeStr}
                      </span>

                      <div className="relative z-[1] p-4 sm:p-5 text-white">
                        {item.categories?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {item.categories.map((cat) => (
                              <span
                                key={cat}
                                className="text-[0.68rem] font-semibold bg-white/20 text-white rounded-full px-2.5 py-0.5 backdrop-blur-sm"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                        <h3 className="text-xl sm:text-2xl font-extrabold leading-tight drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                          {item.title}
                        </h3>
                        <p className="text-sm text-white/85 leading-snug mt-1.5 line-clamp-2">
                          {item.description}
                        </p>

                        <ItemStarRating
                          item={item}
                          municipalSessionId={municipalSession._id}
                          loggedIn={!!authSession}
                        />

                        {item.questionId && (
                          <Link
                            href={`/rosta?q=${item.questionId}`}
                            className="block w-full text-center mt-3.5 bg-accent-400 text-primary-800 font-extrabold text-base py-3 rounded-btn hover:bg-accent-500 transition-colors"
                          >
                            Diskutera &amp; rösta
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                }),
            )}
          </div>
        )}
      </main>
    </div>
  );
}
