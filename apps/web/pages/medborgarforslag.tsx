import {
  useEffect,
  useState,
  useCallback,
  useRef,
  Fragment,
  type FormEvent,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { ArrowLeft, Plus, X } from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useConfig } from "../lib/contexts/ConfigContext";
import { INTEREST_AREAS, INTEREST_TO_CATEGORIES } from "@repo/types";
import MajReviewSheet, {
  type MajDuplicate,
} from "../components/MajReviewSheet";

interface Proposal {
  _id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  categories: string[];
  averageRating: number;
  ratingCount: number;
  rank: number | null;
  inGrace: boolean;
  userRating: number | null;
  isOwn: boolean;
}

export default function MedborgarforslagPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme } = useConfig();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create">("list");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.append("category", filterCategory);
      const res = await fetch(`/api/citizen-proposals?${params.toString()}`);
      const data = await res.json();
      setProposals(Array.isArray(data.proposals) ? data.proposals : []);
    } catch {
      /* keep old list */
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleRate = async (proposalId: string, rating: number) => {
    if (!session) {
      router.push("/login");
      return;
    }
    try {
      const res = await fetchWithCsrf("/api/citizen-proposals/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, rating }),
      });
      if (res.ok) {
        const data = await res.json();
        setProposals((prev) =>
          prev.map((p) =>
            p._id === proposalId
              ? {
                  ...p,
                  ratingCount: data.ratingCount,
                  averageRating: data.averageRating,
                  userRating: data.userRating,
                }
              : p,
          ),
        );
      }
    } catch {
      /* ignore */
    }
  };

  const primaryColor = theme?.colors?.primary?.[600] || "#002d75";
  const primaryDark = theme?.colors?.primary?.[800] || "#001c55";

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
              Till startsidan
            </button>
          </div>
          <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight">
            Förslag
          </h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base">
            Rösta på och lämna förslag för Vallentuna.
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {view === "list" ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <button
                onClick={() =>
                  session ? setView("create") : router.push("/login")
                }
                className="inline-flex items-center gap-1.5 bg-accent-400 text-primary-800 font-extrabold text-sm px-4 py-2.5 rounded-btn hover:bg-accent-500 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nytt förslag
              </button>
              <select
                value={filterCategory || ""}
                onChange={(e) => setFilterCategory(e.target.value || null)}
                className="ml-auto bg-white border border-black/10 rounded-xl px-3 py-2 text-sm text-gray-600"
              >
                <option value="">Alla kategorier</option>
                {(() => {
                  // groupLabel marks the START of the geographic group; split
                  // there so the geo areas land in their own <optgroup>.
                  const geoStart = INTEREST_AREAS.findIndex(
                    (a) => a.groupLabel,
                  );
                  const thematic = INTEREST_AREAS.slice(0, geoStart);
                  const geo = INTEREST_AREAS.slice(geoStart);
                  return (
                    <>
                      {thematic.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                      <optgroup label={INTEREST_AREAS[geoStart].groupLabel}>
                        {geo.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.label}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  );
                })()}
              </select>
            </div>

            {/* Transparency */}
            <div className="flex gap-2.5 items-start bg-[#eef4ff] border border-[#d4e2fb] rounded-xl px-3.5 py-2.5 text-sm text-[#274b8c] leading-snug mb-6">
              <span>🏛️</span>
              <span>
                Förslagen rankas efter era betyg. Den{" "}
                <b className="text-[#1a3a72]">högst rankade</b> lämnas varje
                månad som motion till kommunfullmäktige.
              </span>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Laddar…</div>
            ) : proposals.length === 0 ? (
              <div className="bg-white rounded-card border border-black/5 p-10 text-center">
                <p className="text-gray-500 mb-4">
                  Inga förslag än. Bli först att lämna ett!
                </p>
                <button
                  onClick={() =>
                    session ? setView("create") : router.push("/login")
                  }
                  className="inline-flex items-center gap-1.5 bg-accent-400 text-primary-800 font-extrabold text-sm px-5 py-2.5 rounded-btn hover:bg-accent-500"
                >
                  <Plus className="w-4 h-4" /> Nytt förslag
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {proposals.map((p) => (
                  <ProposalCard
                    key={p._id}
                    p={p}
                    session={session}
                    onRate={handleRate}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <CreateForm
            onCancel={() => setView("list")}
            onCreated={async () => {
              setView("list");
              await fetchProposals();
            }}
            onGoToProposal={(id) => {
              // Clear any category filter so the flagged proposal is in the list.
              setFilterCategory(null);
              setView("list");
              // Wait for the list to render, then reveal the flagged proposal.
              setTimeout(() => {
                document
                  .getElementById(`proposal-${id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 100);
            }}
          />
        )}
      </main>
    </div>
  );
}

function ProposalCard({
  p,
  session,
  onRate,
}: {
  p: Proposal;
  session: any;
  onRate: (id: string, rating: number) => void;
}) {
  const leader = p.rank === 1;

  return (
    <div
      id={`proposal-${p._id}`}
      className={`relative flex flex-col justify-end rounded-[20px] overflow-hidden shadow-[0_14px_32px_-20px_rgba(0,20,64,0.6)] scroll-mt-24 ${
        leader ? "ring-[3px] ring-accent-400 min-h-[255px]" : "min-h-[230px]"
      }`}
    >
      {/* Background */}
      {p.imageUrl ? (
        <img
          src={p.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

      {/* Rank badge */}
      <div
        className={`absolute top-3 left-3 z-10 w-10 h-10 rounded-full flex items-center justify-center font-black tabular-nums border ${
          leader
            ? "bg-accent-400 text-primary-800 border-white"
            : "bg-black/50 text-white border-white/25"
        }`}
      >
        {p.rank}
      </div>
      {p.inGrace && (
        <span className="absolute top-3.5 right-3.5 z-10 text-[0.7rem] font-bold text-white bg-green-700/85 rounded-full px-2.5 py-1">
          🌱 Nytt förslag
        </span>
      )}

      {/* Content */}
      <div className="relative z-[1] p-4 sm:p-5 text-white">
        {leader && (
          <span className="inline-flex items-center gap-1 text-[0.66rem] font-extrabold uppercase tracking-wide text-primary-800 bg-accent-400 rounded-full px-2.5 py-1 mb-2">
            👑 Månadens etta · på väg till fullmäktige
          </span>
        )}
        <h2 className="text-xl font-extrabold leading-tight drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
          {p.title}
        </h2>
        <p className="text-sm text-white/85 leading-snug mt-1.5 line-clamp-2">
          {p.description}
        </p>

        {p.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {p.categories.map((cat) => (
              <span
                key={cat}
                className="text-[0.7rem] font-semibold bg-white/20 text-white rounded-full px-2.5 py-0.5 backdrop-blur-sm"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center gap-3 mt-3.5 flex-wrap">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRate(p._id, star)}
                disabled={!session}
                title={
                  !session ? "Logga in för att rösta" : `Ge ${star} stjärnor`
                }
                className={`text-2xl leading-none transition-transform hover:scale-110 disabled:hover:scale-100 ${
                  star <= (p.userRating || 0)
                    ? "text-accent-400"
                    : "text-white/35"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <span className="text-sm text-white/90">
            <b className="text-white">
              {p.averageRating ? p.averageRating.toFixed(1) : "–"}
            </b>{" "}
            · {p.ratingCount} röster
          </span>
        </div>
        {!session && (
          <p className="text-xs text-white/60 mt-1.5">
            Logga in för att rösta på förslag
          </p>
        )}
      </div>
    </div>
  );
}

function CreateForm({
  onCancel,
  onCreated,
  onGoToProposal,
}: {
  onCancel: () => void;
  onCreated: () => void;
  onGoToProposal: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<{
    corrected: string | null;
    concise: string | null;
    duplicates?: MajDuplicate[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (cat: string) => {
    setSelected((prev) =>
      prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : prev.length < 3
          ? [...prev, cat]
          : prev,
    );
  };

  // Step 1: on submit, let MAJ review the text first (fail-open).
  const runReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || selected.length === 0) return;
    setError("");
    setReviewing(true);
    try {
      const res = await fetchWithCsrf("/api/maj/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: description, kind: "proposal", title }),
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

  // Step 2: publish with the final (possibly MAJ-improved) description.
  const publish = async (finalDescription: string) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetchWithCsrf("/api/citizen-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: finalDescription,
          // `selected` holds INTEREST_AREAS keys; expand to the raw categories
          // the model/filter/display use (same convention as the questions form).
          categories: Array.from(
            new Set(selected.flatMap((k) => INTEREST_TO_CATEGORIES[k] || [])),
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Kunde inte skapa förslaget");
        setReview(null);
        return;
      }
      const proposalId = data.proposal?._id;
      if (image && proposalId) {
        const fd = new FormData();
        fd.append("proposalId", String(proposalId));
        fd.append("image", image);
        await fetch("/api/citizen-proposals/image", {
          method: "POST",
          body: fd,
        }).catch(() => {});
      }
      onCreated();
    } catch {
      setError("Ett fel uppstod");
      setReview(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-card border border-black/5 shadow-[0_10px_30px_-22px_rgba(0,20,64,0.5)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-extrabold text-gray-800">Nytt förslag</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-700"
          aria-label="Stäng"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={runReview} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Rubrik
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="T.ex. 'Bygg fler cykelbanor i centrum'"
            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
            maxLength={200}
            required
          />
          <p className="text-xs text-gray-400 mt-1">{title.length}/200</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Beskrivning
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beskriv ditt förslag…"
            rows={6}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-600/30 resize-y"
            maxLength={2000}
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            {description.length}/2000
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Kategorier (välj 1–3)
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {INTEREST_AREAS.map((area) => {
              const on = selected.includes(area.key);
              return (
                <Fragment key={area.key}>
                  {area.groupLabel && (
                    <div className="w-full text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-0.5">
                      {area.groupLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(area.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      on
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {area.label}
                  </button>
                </Fragment>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {selected.length}/3 valda
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Bild (valfritt)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
          />
          {image && (
            <p className="text-xs text-green-600 mt-1">✓ {image.name}</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-btn border border-gray-200 text-gray-600 font-bold hover:bg-gray-50"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={reviewing || submitting || selected.length === 0}
            className="flex-1 px-5 py-2.5 rounded-btn bg-accent-400 text-primary-800 font-extrabold hover:bg-accent-500 disabled:opacity-40"
          >
            {reviewing ? "MAJ tittar…" : "Skicka förslag"}
          </button>
        </div>
      </form>

      {review && (
        <MajReviewSheet
          originalText={description}
          review={review}
          kind="proposal"
          hasImage={!!image}
          onPickImage={() => fileRef.current?.click()}
          onPublish={(finalText) => publish(finalText)}
          onGoToProposal={onGoToProposal}
          onCancel={() => setReview(null)}
        />
      )}
    </div>
  );
}
