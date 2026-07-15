import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useConfig } from "../lib/contexts/ConfigContext";
import MajReviewSheet, {
  type MajDuplicate,
} from "../components/MajReviewSheet";

const STORAGE_SELECTED_QUESTION = "vf_selected_question";

const TYPE_META = {
  for: { label: "För", dot: "#22c55e" },
  against: { label: "Emot", dot: "#ef4444" },
  neutral: { label: "Neutral", dot: "#9ca3af" },
};

function sortComments(list) {
  return [...list].sort(
    (a, b) =>
      b.averageRating - a.averageRating ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export default function RostaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme } = useConfig();

  const [question, setQuestion] = useState(null);
  const [hasSelection, setHasSelection] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.replace("/login");
  }, [status, session, router]);

  const load = useCallback(async (preferredId?: string | null) => {
    // A ?q= param (e.g. from a municipal item's "Diskutera & Rösta" button)
    // takes precedence over the last Hem selection; we persist it so a reload
    // and the "Välj en annan fråga" flow behave consistently.
    let selectedId = preferredId || null;
    if (selectedId) {
      try {
        localStorage.setItem(STORAGE_SELECTED_QUESTION, selectedId);
      } catch {
        /* ignore */
      }
    } else {
      try {
        selectedId = localStorage.getItem(STORAGE_SELECTED_QUESTION);
      } catch {
        /* ignore */
      }
    }
    if (!selectedId) {
      setHasSelection(false);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/questions");
      if (res.ok) {
        const data = await res.json();
        const found = (data.questions || []).find((q) => q.id === selectedId);
        setQuestion(found || null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !router.isReady) return;
    const q = typeof router.query.q === "string" ? router.query.q : null;
    load(q);
  }, [session, router.isReady, router.query.q, load]);

  const chooseAnother = () => {
    try {
      localStorage.removeItem(STORAGE_SELECTED_QUESTION);
    } catch {
      /* ignore */
    }
    router.push("/");
  };

  if (status === "loading" || !session)
    return <div className="p-8">Laddar…</div>;

  const primaryColor = theme?.colors?.primary?.[600] || "#002d75";
  const primaryDark = theme?.colors?.primary?.[800] || "#001c55";
  const isAdmin = !!(session.user?.isAdmin || session.user?.isSuperAdmin);

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
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
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-accent-400 text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Hem
            </button>
          </div>
          <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight">
            Rösta
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Laddar frågan…</div>
        ) : !hasSelection || !question ? (
          <div className="bg-white rounded-card border border-black/5 p-10 text-center">
            <p className="text-gray-700 font-semibold mb-1">Ingen fråga vald</p>
            <p className="text-gray-500 text-sm mb-5">
              Välj en fråga på Hem-sidan för att rösta och debattera.
            </p>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 bg-accent-400 text-primary-800 font-extrabold text-sm px-5 py-2.5 rounded-btn hover:bg-accent-500"
            >
              Till Hem
            </button>
          </div>
        ) : (
          <>
            <VoteCard
              question={question}
              onVoted={(voteCounts, userVote) =>
                setQuestion((q) => ({ ...q, voteCounts, userVote }))
              }
              onChooseAnother={chooseAnother}
            />
            <DebateSection questionId={question.id} isAdmin={isAdmin} />
          </>
        )}
      </main>
    </div>
  );
}

function VoteCard({ question, onVoted, onChooseAnother }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const voted = !!question.userVote && !editing;
  const ja = question.voteCounts?.ja || 0;
  const nej = question.voteCounts?.nej || 0;
  const total = ja + nej;
  const jaPct = total ? Math.round((ja / total) * 100) : 0;
  const nejPct = total ? 100 - jaPct : 0;

  const deadline = question.deadline
    ? new Date(question.deadline).toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "long",
      })
    : null;

  const submitVote = async (choice) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetchWithCsrf("/api/questions/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, choice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Röstning misslyckades");
        return;
      }
      onVoted(data.voteCounts, data.userVote);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col justify-end rounded-[20px] overflow-hidden min-h-[300px] shadow-[0_14px_32px_-20px_rgba(0,20,64,0.6)] mb-5">
      {question.imageUrl ? (
        <img
          src={question.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

      <div className="relative z-[1] p-5 text-white">
        {question.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {question.categories.map((cat) => (
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
          {question.text}
        </p>
        {deadline && (
          <p className="text-sm text-white/75 mt-2">Stänger {deadline}</p>
        )}

        {error && (
          <div className="mt-3 text-sm bg-red-500/25 border border-red-300/40 text-red-50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {voted ? (
          <div className="mt-4 space-y-2.5">
            <ResultBar
              label="Ja"
              pct={jaPct}
              count={ja}
              color="#22c55e"
              chosen={question.userVote === "ja"}
            />
            <ResultBar
              label="Nej"
              pct={nejPct}
              count={nej}
              color="#ef4444"
              chosen={question.userVote === "nej"}
            />
            <div className="flex items-center justify-between pt-1.5">
              <span className="text-sm text-white/80">
                {total} {total === 1 ? "röst" : "röster"} · Din röst:{" "}
                <b className="text-white">
                  {question.userVote === "ja" ? "Ja" : "Nej"}
                </b>
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-sm font-semibold text-accent-400 hover:text-accent-500"
              >
                Ändra röst
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              disabled={submitting}
              onClick={() => submitVote("ja")}
              className="py-3.5 rounded-btn font-extrabold text-base bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Ja
            </button>
            <button
              disabled={submitting}
              onClick={() => submitVote("nej")}
              className="py-3.5 rounded-btn font-extrabold text-base bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              Nej
            </button>
          </div>
        )}

        <button
          onClick={onChooseAnother}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Välj en annan fråga
        </button>
      </div>
    </div>
  );
}

function ResultBar({ label, pct, count, color, chosen }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold">
          {label}
          {chosen && " ✓"}
        </span>
        <span className="text-white/80">
          {pct}% · {count}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            opacity: chosen ? 1 : 0.55,
          }}
        />
      </div>
    </div>
  );
}

function DebateSection({ questionId, isAdmin }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [type, setType] = useState("for");
  const [posting, setPosting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<{
    corrected: string | null;
    concise: string | null;
    duplicates?: MajDuplicate[];
  } | null>(null);
  const [pendingText, setPendingText] = useState("");
  const [moderation, setModeration] = useState(null); // {status,message} for warn/flag

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/questions/comments?questionId=${questionId}`,
      );
      if (res.ok) setComments(sortComments(await res.json()));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    load();
  }, [load]);

  const doPost = async (finalText: string) => {
    setPosting(true);
    try {
      const res = await fetchWithCsrf("/api/questions/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, text: finalText.trim(), type }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => sortComments([data, ...prev]));
        setText("");
        setModeration(null);
        setReview(null);
        setPendingText("");
      } else {
        alert(data.message || "Kunde inte posta kommentaren");
      }
    } finally {
      setPosting(false);
    }
  };

  // Step 1: MAJ reviews the argument (fail-open), then shows its tips sheet.
  const handleSend = async () => {
    if (!text.trim() || posting || reviewing) return;
    setReviewing(true);
    try {
      const res = await fetchWithCsrf("/api/maj/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          kind: "argument",
          questionId,
          stance: type,
        }),
      });
      const data = res.ok
        ? await res.json()
        : { corrected: null, concise: null, duplicates: [] };
      setReview(data);
    } catch {
      setReview({ corrected: null, concise: null, duplicates: [] });
    } finally {
      setReviewing(false);
    }
  };

  // Step 2: after MAJ's tips, run the moderation gate on the final text, then post.
  const afterReview = async (finalText: string) => {
    setReview(null);
    try {
      const res = await fetchWithCsrf("/api/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalText.trim() }),
      });
      const result = await res.json();
      if (result.status === "ok") {
        await doPost(finalText);
      } else {
        setPendingText(finalText);
        setModeration(result); // warn/flag → confirm inline
      }
    } catch {
      await doPost(finalText); // fail open
    }
  };

  const deleteComment = async (commentId) => {
    if (!confirm("Ta bort det här inlägget?")) return;
    try {
      const res = await fetchWithCsrf("/api/questions/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Kunde inte ta bort inlägget");
      }
    } catch {
      /* ignore */
    }
  };

  const rateComment = async (commentId, rating) => {
    try {
      const res = await fetchWithCsrf("/api/questions/comments/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, rating }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) =>
          sortComments(
            prev.map((c) =>
              c._id === commentId
                ? {
                    ...c,
                    averageRating: data.averageRating,
                    userRating: rating,
                  }
                : c,
            ),
          ),
        );
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="bg-white rounded-card border border-black/5 shadow-[0_10px_30px_-22px_rgba(0,20,64,0.5)] p-5">
      <h2 className="text-lg font-extrabold text-gray-800 mb-3">Debatt</h2>

      {/* Composer */}
      <div className="mb-5">
        <div className="flex gap-2 mb-2">
          {(["for", "against", "neutral"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                type === t
                  ? "border-primary-600 bg-primary-600/5 text-primary-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: TYPE_META[t].dot }}
              />
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Argumentera här…"
          rows={3}
          maxLength={1000}
          className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-600/30 resize-y"
        />

        {moderation ? (
          <div
            className={`mt-2 rounded-xl p-3 text-sm border ${
              moderation.status === "flag"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <p className="mb-1">
              {moderation.message || "Vill du publicera ändå?"}
            </p>
            {moderation.status === "flag" && (
              <p className="text-xs mb-2">
                Du ansvarar själv för innehållet du publicerar.
              </p>
            )}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => doPost(pendingText || text)}
                disabled={posting}
                className="text-sm font-bold px-3 py-1.5 rounded-lg bg-accent-400 text-primary-800 hover:bg-accent-500 disabled:opacity-50"
              >
                Publicera ändå
              </button>
              <button
                onClick={() => setModeration(null)}
                className="text-sm font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() || posting || reviewing}
            className="mt-2 bg-accent-400 text-primary-800 font-extrabold text-sm px-5 py-2.5 rounded-btn hover:bg-accent-500 disabled:opacity-40"
          >
            {reviewing
              ? "MAJ tittar…"
              : posting
                ? "Publicerar…"
                : "Skicka inlägg"}
          </button>
        )}
      </div>

      {review && (
        <MajReviewSheet
          originalText={text}
          review={review}
          kind="argument"
          onPublish={(finalText) => afterReview(finalText)}
          onCancel={() => setReview(null)}
        />
      )}

      {/* Comments */}
      {loading ? (
        <div className="text-gray-500 text-sm py-4">Laddar debatt…</div>
      ) : comments.length === 0 ? (
        <div className="text-gray-500 text-sm py-4">
          Inga inlägg än — bli först att argumentera.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentRow
              key={c._id}
              c={c}
              onRate={rateComment}
              canDelete={c.isOwn || isAdmin}
              onDelete={deleteComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({ c, onRate, canDelete, onDelete }) {
  const meta = TYPE_META[c.type] || TYPE_META.neutral;
  return (
    <div className="border-b border-black/5 last:border-b-0 pb-3 last:pb-0">
      <div className="flex items-start gap-2.5">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: meta.dot }}
          title={meta.label}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-800 leading-relaxed">
            {c.text}
            {c.isOwn && (
              <span className="ml-2 align-middle text-[0.6rem] font-bold uppercase tracking-wide text-primary-600 bg-primary-600/10 rounded px-1.5 py-0.5">
                Du
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onRate(c._id, star)}
                  title={`Ge ${star}`}
                  className={`text-base leading-none hover:scale-110 transition-transform ${
                    star <= (c.userRating || 0)
                      ? "text-accent-500"
                      : "text-gray-300"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">
              {c.averageRating > 0 ? c.averageRating.toFixed(1) : "—"}
            </span>
            {canDelete && (
              <button
                onClick={() => onDelete(c._id)}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" /> Ta bort
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
