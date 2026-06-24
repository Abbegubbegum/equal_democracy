import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Calendar, Archive, TrendingUp, Star } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "../../../lib/hooks/useTranslation";
import { fetchWithCsrf } from "../../../lib/fetch-with-csrf";

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
    <div className="flex items-center gap-2 mb-3">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={submitting}
            onClick={() => submitRating(n)}
            className="p-0.5"
            title={`Betygsätt ${n} av 5`}
          >
            <Star
              className={`w-5 h-5 ${
                n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
      {aggregate.ratingCount > 0 && (
        <span className="text-xs text-amber-600">
          ★ {aggregate.averageRating.toFixed(1)} ({aggregate.ratingCount})
        </span>
      )}
    </div>
  );
}

export default function BoardPage() {
  const router = useRouter();
  const { data: authSession } = useSession();
  const { municipality: municipalityParam, board: boardParam } = router.query;
  const municipality = String(municipalityParam || "");
  const board = String(boardParam || "");
  const { t } = useTranslation();
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
    return <div className="p-8">Laddar...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-600 text-white p-6 shadow">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 capitalize">
                {board.replace(/-/g, " ")}
              </h1>
              <p className="text-primary-100 capitalize">
                {municipality} kommun
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-yellow-400 text-gray-900 hover:bg-yellow-500 rounded-lg font-medium"
            >
              {t("common.backToStart")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Navigation */}
        <div className="mb-6 flex gap-2">
          <button className="px-4 py-2 bg-white text-primary-600 shadow rounded-lg font-medium">
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Aktiva Frågor
          </button>
          <Link
            href={`/${municipality}/${board}/archive`}
            className="px-4 py-2 bg-white text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            <Archive className="w-4 h-4 inline mr-2" />
            Arkiv
          </Link>
        </div>

        {/* Active Sessions */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Laddar...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">
              Inga aktiva frågor för tillfället
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((municipalSession) => (
              <div key={municipalSession._id} className="space-y-4">
                {municipalSession.items
                  .filter((item) => item.status === "active")
                  .map((item, idx) => {
                    // Format date for each item
                    const itemDate = new Date(
                      municipalSession.meetingDate,
                    ).toLocaleDateString("sv-SE", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    });
                    const itemTime = municipalSession.meetingTime || "18:00";
                    const dateTimeStr = `${itemDate} ${itemTime}`;

                    return (
                      <div
                        key={idx}
                        className="border-l-4 border-primary-500 pl-4 hover:bg-gray-50 p-4 rounded bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-2 gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-600">
                                {dateTimeStr}
                              </span>
                            </div>
                            <h3 className="font-bold text-xl mb-2 text-gray-900">
                              {item.title}
                            </h3>
                          </div>
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                        </div>
                        <p className="text-gray-700 mb-3 leading-relaxed">
                          {item.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {item.categories.map((cat) => (
                            <span
                              key={cat}
                              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                        <ItemStarRating
                          item={item}
                          municipalSessionId={municipalSession._id}
                          loggedIn={!!authSession}
                        />
                        {item.sessionId && (
                          <Link
                            href={`/session/${item.sessionId}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                          >
                            <TrendingUp className="w-4 h-4" />
                            Diskutera & Rösta
                          </Link>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
