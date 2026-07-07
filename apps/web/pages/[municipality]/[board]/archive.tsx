import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, TrendingUp, Calendar } from "lucide-react";
import Link from "next/link";
import { useConfig } from "../../../lib/contexts/ConfigContext";

export async function getServerSideProps({ params }) {
  const VALID_MUNICIPALITIES = ["vallentuna"];
  if (!VALID_MUNICIPALITIES.includes(params.municipality)) {
    return { notFound: true };
  }
  return { props: {} };
}

export default function BoardArchivePage() {
  const router = useRouter();
  const { theme } = useConfig();
  const { municipality: municipalityParam, board: boardParam } = router.query;
  const municipality = String(municipalityParam || "");
  const board = String(boardParam || "");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (municipality && board) {
      fetchArchivedSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipality, board]);

  const fetchArchivedSessions = async () => {
    try {
      const res = await fetch(
        `/api/municipal/board-sessions?municipality=${municipality}&board=${board}&status=closed`,
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

  const hasItems = sessions.some(
    (s) => s.items.filter((i) => i.status === "closed").length > 0,
  );

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
              onClick={() => router.push(`/${municipality}/${board}`)}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-accent-400 text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Aktiva frågor
            </button>
          </div>
          <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight capitalize">
            {board.replace(/-/g, " ")} – arkiv
          </h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base capitalize">
            {municipality} kommun
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Sub-nav */}
        <div className="flex gap-2 mb-5">
          <Link
            href={`/${municipality}/${board}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-black/5 text-gray-600 text-sm font-semibold rounded-btn hover:bg-[#fafbfe]"
          >
            <TrendingUp className="w-4 h-4" />
            Aktiva frågor
          </Link>
          <span className="px-3.5 py-2 bg-primary-600 text-white text-sm font-bold rounded-btn">
            Arkiv
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Laddar…</div>
        ) : !hasItems ? (
          <div className="bg-white rounded-card border border-black/5 p-10 text-center text-gray-500">
            Inga arkiverade frågor ännu.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((municipalSession) =>
              municipalSession.items
                .filter((item) => item.status === "closed")
                .map((item) => {
                  const dateStr = new Date(
                    municipalSession.meetingDate,
                  ).toLocaleDateString("sv-SE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <div
                      key={item._id}
                      className="bg-white rounded-card border border-black/5 shadow-[0_8px_22px_-18px_rgba(0,20,64,0.4)] p-4 flex gap-3.5"
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-16 h-16 rounded-xl object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {dateStr}
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[0.62rem] font-bold uppercase tracking-wide">
                            Avslutad
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-800 mt-1">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                        {item.ratingCount > 0 && (
                          <p className="text-xs text-accent-500 mt-1.5">
                            ★ {item.averageRating.toFixed(1)} (
                            {item.ratingCount})
                          </p>
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
