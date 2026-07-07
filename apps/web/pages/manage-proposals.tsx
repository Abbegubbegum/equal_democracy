import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  Pencil,
  ImagePlus,
  Trash2,
  X,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useConfig } from "../lib/contexts/ConfigContext";

interface Proposal {
  _id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  status: string;
  authorName?: string | null;
  averageRating: number;
  ratingCount: number;
  score: number | null;
  rank: number | null;
  ageDays: number | null;
  inGrace: boolean;
  atRisk: boolean;
  fullmaktigeOutcome?: "approved" | "rejected" | null;
  fullmaktigeDecisionAt?: string | null;
}

const GRACE_DAYS = 10;

export default function ManageProposalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme } = useConfig();

  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Proposal | null>(null);

  const uploadTargetId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.replace("/login");
    else if (!session.user?.isAdmin && !session.user?.isSuperAdmin)
      router.replace("/");
  }, [status, session, router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/citizen-proposals");
      if (res.ok) setItems(await res.json());
    } catch {
      /* keep old list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.isAdmin || session?.user?.isSuperAdmin) load();
  }, [session, load]);

  if (status === "loading") return <div className="p-8">Laddar…</div>;
  if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) return null;

  const primaryColor = theme?.colors?.primary?.[600] || "#002d75";
  const primaryDark = theme?.colors?.primary?.[800] || "#001c55";

  const stack = items
    .filter((p) => p.status === "active")
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const archived = items.filter((p) => p.status !== "active");

  const nextMotion = new Date();
  nextMotion.setMonth(nextMotion.getMonth() + 1, 1);
  const nextMotionLabel = nextMotion.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });

  async function patch(body: Record<string, unknown>) {
    setBusyId(body.id as string);
    try {
      const res = await fetchWithCsrf("/api/admin/citizen-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Åtgärden misslyckades");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function triggerUpload(id: string) {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  }

  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTargetId.current;
    e.target.value = ""; // allow re-picking the same file
    if (!file || !id) return;

    setBusyId(id);
    try {
      const fd = new FormData();
      fd.append("proposalId", id);
      fd.append("image", file);
      const res = await fetch("/api/admin/citizen-proposal-image", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Bilduppladdning misslyckades");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header
        className="text-white px-4 sm:px-6 pt-5 pb-8 shadow-lg"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
        }}
      >
        <div className="max-w-4xl mx-auto">
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
              onClick={() => router.push("/manage-content")}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-accent-400 text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Hantera innehåll
            </button>
          </div>
          <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight">
            Förslag
          </h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base">
            Rankad stack – invånarnas förslag, sorterade efter medborgarnas
            betyg.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <span className="bg-white border border-black/5 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-[0_6px_16px_-14px_rgba(0,20,64,0.4)]">
            <b className="text-primary-600">{stack.length}</b> aktiva av 20
          </span>
          <span className="bg-white border border-black/5 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-[0_6px_16px_-14px_rgba(0,20,64,0.4)]">
            Nästa motion: <b className="text-primary-600">{nextMotionLabel}</b>
          </span>
          <button
            onClick={() => setShowArchive((s) => !s)}
            className="ml-auto text-sm font-semibold text-primary-600 hover:underline"
          >
            {showArchive ? "Dölj arkiv" : `Arkiv (${archived.length}) →`}
          </button>
        </div>

        {/* Info */}
        <div className="flex gap-2.5 items-start bg-[#fff8ec] border border-[#f6e2b8] rounded-xl px-3.5 py-2.5 text-sm text-[#7a5a12] leading-snug mb-6">
          <span>ℹ️</span>
          <span>
            Poäng = <b>antal röster × snittbetyg³</b>. Den 1:a varje månad lyfts{" "}
            <b>#1</b> av stacken som motion till fullmäktige – du får ett{" "}
            <b>mejl</b> om vilket förslag det blev. Förslag äldre än{" "}
            {GRACE_DAYS} dagar utanför topp 20 arkiveras.
          </span>
        </div>

        {loading ? (
          <div className="text-gray-500 py-10 text-center">Laddar stacken…</div>
        ) : stack.length === 0 ? (
          <div className="text-gray-500 py-10 text-center">
            Inga aktiva förslag ännu.
          </div>
        ) : (
          <>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-3">
              Stacken
            </div>
            <div className="space-y-3">
              {stack.map((p) => (
                <ProposalCard
                  key={p._id}
                  p={p}
                  busy={busyId === p._id}
                  onEdit={() => setEditItem(p)}
                  onImage={() => triggerUpload(p._id)}
                  onMotion={() => {
                    if (
                      confirm(
                        `Skicka "${p.title}" som motion till fullmäktige nu? Den lyfts av stacken.`,
                      )
                    )
                      patch({ id: p._id, action: "sendAsMotion" });
                  }}
                  onRemove={() => {
                    if (confirm(`Ta bort och arkivera "${p.title}"?`))
                      patch({ id: p._id, status: "archived" });
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Archive */}
        {showArchive && (
          <div className="mt-8">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">
              Arkiv &amp; motioner
            </div>
            {archived.length === 0 ? (
              <div className="text-gray-400 text-sm">Arkivet är tomt.</div>
            ) : (
              <div className="space-y-2">
                {archived.map((p) => (
                  <div
                    key={p._id}
                    className="bg-white/70 border border-black/5 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[0.66rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          p.status === "motion"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.status === "motion" ? "Motion" : "Arkiverad"}
                      </span>
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {p.title}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {p.ratingCount} röster · ★ {p.averageRating.toFixed(1)}
                      </span>
                    </div>

                    {p.status === "motion" && (
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <span className="text-xs text-gray-500">
                          Fullmäktige:
                        </span>
                        <button
                          onClick={() =>
                            patch({
                              id: p._id,
                              action: "setFullmaktigeOutcome",
                              outcome:
                                p.fullmaktigeOutcome === "approved"
                                  ? null
                                  : "approved",
                            })
                          }
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                            p.fullmaktigeOutcome === "approved"
                              ? "bg-green-50 border-green-300 text-green-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Godkänd
                        </button>
                        <button
                          onClick={() =>
                            patch({
                              id: p._id,
                              action: "setFullmaktigeOutcome",
                              outcome:
                                p.fullmaktigeOutcome === "rejected"
                                  ? null
                                  : "rejected",
                            })
                          }
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                            p.fullmaktigeOutcome === "rejected"
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> Avslagen
                        </button>
                        {p.fullmaktigeDecisionAt && p.fullmaktigeOutcome && (
                          <span className="text-xs text-gray-400">
                            {new Date(
                              p.fullmaktigeDecisionAt,
                            ).toLocaleDateString("sv-SE")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Hidden file input shared by all image buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFilePicked}
      />

      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={async (title, description) => {
            await patch({ id: editItem._id, title, description });
            setEditItem(null);
          }}
        />
      )}
    </div>
  );
}

function ProposalCard({ p, busy, onEdit, onImage, onMotion, onRemove }) {
  const leader = p.rank === 1;
  const graceLeft = Math.max(0, GRACE_DAYS - (p.ageDays ?? 0));

  return (
    <div
      className={`flex gap-3.5 bg-white rounded-2xl p-3.5 transition-shadow ${
        leader
          ? "border-2 border-accent-400 shadow-[0_14px_34px_-18px_rgba(245,166,35,0.55)]"
          : "border border-black/5 shadow-[0_8px_22px_-18px_rgba(0,20,64,0.45)]"
      } ${busy ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* Rank */}
      <div className="flex flex-col items-center justify-center w-10 shrink-0">
        {leader && <span className="text-base leading-none">👑</span>}
        <span
          className={`font-black tabular-nums leading-none ${
            leader ? "text-accent-400 text-3xl" : "text-gray-400 text-2xl"
          }`}
        >
          {p.rank}
        </span>
      </div>

      {/* Thumb */}
      {p.imageUrl ? (
        <img
          src={p.imageUrl}
          alt=""
          className="w-[74px] h-[74px] rounded-xl object-cover shrink-0"
        />
      ) : (
        <button
          onClick={onImage}
          className="w-[74px] h-[74px] rounded-xl shrink-0 border-[1.5px] border-dashed border-gray-300 bg-gray-50 text-gray-400 text-[0.66rem] font-semibold grid place-items-center text-center px-1 hover:bg-gray-100"
        >
          + Lägg till bild
        </button>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        {leader && (
          <span className="inline-flex items-center gap-1 text-[0.66rem] font-extrabold uppercase tracking-wide text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 mb-1">
            👑 Månadens ledare
          </span>
        )}
        <h2 className="text-base font-extrabold text-gray-800">{p.title}</h2>
        <p className="text-sm text-gray-500 leading-snug mt-1 line-clamp-2">
          {p.description}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[0.78rem] text-gray-600">
          <span>
            <b className="text-gray-800">{p.score?.toLocaleString("sv-SE")}</b>{" "}
            poäng
          </span>
          <span>
            <b className="text-gray-800">{p.ratingCount}</b> röster
          </span>
          <span className="text-accent-500">
            ★ {p.averageRating.toFixed(1)}
          </span>
          {p.inGrace ? (
            <span className="text-green-700 font-semibold">
              🌱 Ny · skyddad i {graceLeft} dagar
            </span>
          ) : p.atRisk ? (
            <span className="text-amber-700 font-semibold">
              ⚠️ Riskzon · faller ur snart
            </span>
          ) : (
            <span className="text-gray-500">Topp 20</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-[0.78rem] font-bold px-2.5 py-1.5 rounded-[10px] bg-[#eef2fb] text-primary-600 hover:brightness-95"
          >
            <Pencil className="w-3.5 h-3.5" /> Redigera text
          </button>
          <button
            onClick={onImage}
            className="inline-flex items-center gap-1.5 text-[0.78rem] font-bold px-2.5 py-1.5 rounded-[10px] bg-[#eef2fb] text-primary-600 hover:brightness-95"
          >
            <ImagePlus className="w-3.5 h-3.5" />{" "}
            {p.imageUrl ? "Byt bild" : "Lägg till bild"}
          </button>
          {leader && (
            <button
              onClick={onMotion}
              className="inline-flex items-center text-[0.78rem] font-bold px-2.5 py-1.5 rounded-[10px] bg-accent-400 text-primary-800 hover:bg-accent-500"
            >
              Skicka som motion nu
            </button>
          )}
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 text-[0.78rem] font-bold px-2.5 py-1.5 rounded-[10px] text-red-700 border border-red-200 hover:bg-red-50 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Ta bort
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ item, onClose, onSaved }) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim() && description.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-gray-800">
            Redigera förslag
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Rubrik
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
        />

        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Beskrivning
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={6}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 mb-5 focus:outline-none focus:ring-2 focus:ring-primary-600/30 resize-y"
        />

        <div className="flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            className="font-bold text-sm px-4 py-2.5 rounded-btn text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Avbryt
          </button>
          <button
            disabled={!canSave || saving}
            onClick={async () => {
              setSaving(true);
              await onSaved(title.trim(), description.trim());
              setSaving(false);
            }}
            className="font-bold text-sm px-5 py-2.5 rounded-btn bg-accent-400 text-primary-800 hover:bg-accent-500 disabled:opacity-40"
          >
            {saving ? "Sparar…" : "Spara"}
          </button>
        </div>
      </div>
    </div>
  );
}
