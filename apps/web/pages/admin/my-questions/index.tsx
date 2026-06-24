import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Shield, ImagePlus, Pencil } from "lucide-react";
import { ALL_CATEGORIES, INTEREST_AREAS } from "@repo/types";
import { fetchWithCsrf } from "../../../lib/fetch-with-csrf";
import MyQuestionsSubNav from "../../../components/admin/MyQuestionsSubNav";

interface MunicipalItemRow {
  id: string;
  municipalSessionId: string;
  sessionName: string;
  title: string;
  description: string;
  categories: string[];
  imageUrl: string | null;
  averageRating: number;
  ratingCount: number;
  status: string;
}

interface BudgetCategoryRow {
  id: string;
  sessionId: string;
  sessionName: string;
  name: string;
  tags: string[];
  imageUrl: string | null;
  averageRating: number;
  ratingCount: number;
  defaultAmount: number;
}

interface CitizenProposalRow {
  id: string;
  title: string;
  description: string;
  categories: string[];
  imageUrl: string | null;
  averageRating: number;
  ratingCount: number;
  status: string;
}

export default function MyQuestionsOverviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<string>("budget");
  const [loading, setLoading] = useState(true);
  const [municipalItems, setMunicipalItems] = useState<MunicipalItemRow[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryRow[]>(
    [],
  );
  const [citizenProposals, setCitizenProposals] = useState<
    CitizenProposalRow[]
  >([]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.replace("/login");
    else if (!session.user?.isAdmin && !session.user?.isSuperAdmin)
      router.replace("/");
  }, [status, session, router]);

  const load = useCallback(async (interest: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/my-questions/overview?interest=${interest}`,
      );
      if (res.ok) {
        const data = await res.json();
        setMunicipalItems(data.municipalItems || []);
        setBudgetCategories(data.budgetCategories || []);
        setCitizenProposals(data.citizenProposals || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) load(activeKey);
  }, [session, activeKey, load]);

  async function uploadMunicipalItemImage(item: MunicipalItemRow, file: File) {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("municipalSessionId", item.municipalSessionId);
    formData.append("itemId", item.id);
    const res = await fetch("/api/admin/municipal-item-image", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const { imageUrl } = await res.json();
      setMunicipalItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, imageUrl } : i)),
      );
    } else {
      alert("Kunde inte ladda upp bilden");
    }
  }

  async function uploadBudgetCategoryImage(cat: BudgetCategoryRow, file: File) {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("sessionId", cat.sessionId);
    formData.append("categoryId", cat.id);
    const res = await fetch("/api/admin/budget-category-image", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const { imageUrl } = await res.json();
      setBudgetCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, imageUrl } : c)),
      );
    } else {
      alert("Kunde inte ladda upp bilden");
    }
  }

  async function saveProposalEdit(
    id: string,
    fields: { title: string; description: string; categories: string[] },
  ) {
    const res = await fetchWithCsrf("/api/admin/citizen-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    if (res.ok) {
      setCitizenProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...fields } : p)),
      );
    } else {
      alert("Kunde inte spara ändringarna");
    }
  }

  if (status === "loading") return <div className="p-8">Laddar…</div>;
  if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-800 text-white p-6 shadow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-400 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mina frågor</h1>
              <p className="text-slate-300 text-sm">
                Kallelser, budget och förslag samlade per intresseområde
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-slate-900 font-medium rounded-lg transition-colors"
          >
            Tillbaka till Admin
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <MyQuestionsSubNav active="overview" />

        <div className="mb-6 flex gap-2 flex-wrap">
          {INTEREST_AREAS.map((area) => (
            <button
              key={area.key}
              onClick={() => setActiveKey(area.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeKey === area.key
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {area.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-12">Laddar…</div>
        ) : (
          <div className="space-y-8">
            <Section title="Kommunala ärenden (Kallelser)">
              {municipalItems.length === 0 ? (
                <Empty />
              ) : (
                municipalItems.map((item) => (
                  <MunicipalCard
                    key={item.id}
                    item={item}
                    onUploadImage={(file) =>
                      uploadMunicipalItemImage(item, file)
                    }
                    onEditLink={() =>
                      router.push("/admin/my-questions/municipal")
                    }
                  />
                ))
              )}
            </Section>

            <Section title="Budgetkategorier">
              {budgetCategories.length === 0 ? (
                <Empty />
              ) : (
                budgetCategories.map((cat) => (
                  <BudgetCard
                    key={`${cat.sessionId}-${cat.id}`}
                    category={cat}
                    onUploadImage={(file) =>
                      uploadBudgetCategoryImage(cat, file)
                    }
                    onEditLink={() => router.push("/admin/my-questions/budget")}
                  />
                ))
              )}
            </Section>

            <Section title="Medborgarförslag (Förslag)">
              {citizenProposals.length === 0 ? (
                <Empty />
              ) : (
                citizenProposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onSave={saveProposalEdit}
                  />
                ))
              )}
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-800 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty() {
  return (
    <div className="text-center text-slate-400 py-6 bg-white rounded-xl border border-slate-100">
      Inget i detta intresseområde just nu.
    </div>
  );
}

function RatingBadge({
  averageRating,
  ratingCount,
}: {
  averageRating: number;
  ratingCount: number;
}) {
  if (!ratingCount) return null;
  return (
    <span className="text-xs text-amber-600">
      ★ {averageRating.toFixed(1)} ({ratingCount})
    </span>
  );
}

function ImageUploadControl({
  imageUrl,
  onUpload,
}: {
  imageUrl: string | null;
  onUpload: (_file: File) => Promise<void> | void;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="flex-shrink-0 space-y-1">
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-16 h-16 rounded-lg object-cover"
        />
      )}
      <label
        className={`flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${
          uploading
            ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400"
            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
        }`}
      >
        <ImagePlus className="w-3.5 h-3.5" />
        {uploading ? "Laddar upp…" : imageUrl ? "Byt bild" : "Lägg till bild"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setUploading(true);
            try {
              await onUpload(file);
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
    </div>
  );
}

function MunicipalCard({
  item,
  onUploadImage,
  onEditLink,
}: {
  item: MunicipalItemRow;
  onUploadImage: (_file: File) => Promise<void>;
  onEditLink: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
      <ImageUploadControl imageUrl={item.imageUrl} onUpload={onUploadImage} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">{item.sessionName}</span>
          <RatingBadge
            averageRating={item.averageRating}
            ratingCount={item.ratingCount}
          />
        </div>
        <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
        <p className="text-slate-500 text-xs line-clamp-2">
          {item.description}
        </p>
        {item.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.categories.map((c) => (
              <span
                key={c}
                className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onEditLink}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <Pencil className="w-3 h-3" />
          Redigera i Kallelser
        </button>
      </div>
    </div>
  );
}

function BudgetCard({
  category,
  onUploadImage,
  onEditLink,
}: {
  category: BudgetCategoryRow;
  onUploadImage: (_file: File) => Promise<void>;
  onEditLink: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
      <ImageUploadControl
        imageUrl={category.imageUrl}
        onUpload={onUploadImage}
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">{category.sessionName}</span>
          <RatingBadge
            averageRating={category.averageRating}
            ratingCount={category.ratingCount}
          />
        </div>
        <p className="font-semibold text-slate-800 text-sm">{category.name}</p>
        <p className="text-slate-500 text-xs">
          {(category.defaultAmount / 1_000_000).toFixed(1)} mnkr
        </p>
        {category.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {category.tags.map((c) => (
              <span
                key={c}
                className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onEditLink}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <Pencil className="w-3 h-3" />
          Redigera i Budget
        </button>
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onSave,
}: {
  proposal: CitizenProposalRow;
  onSave: (
    _id: string,
    _fields: { title: string; description: string; categories: string[] },
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(proposal.title);
  const [description, setDescription] = useState(proposal.description);
  const [categories, setCategories] = useState<string[]>(proposal.categories);
  const [saving, setSaving] = useState(false);

  function toggleCategory(c: string) {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(proposal.id, { title, description, categories });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
      {proposal.imageUrl && (
        <img
          src={proposal.imageUrl}
          alt=""
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <RatingBadge
          averageRating={proposal.averageRating}
          ratingCount={proposal.ratingCount}
        />
        {editing ? (
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full px-2 py-1 rounded border border-slate-300 text-sm font-semibold text-slate-800"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full px-2 py-1 rounded border border-slate-300 text-xs text-slate-600"
            />
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    categories.includes(c)
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {saving ? "Sparar…" : "Spara"}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold disabled:opacity-50"
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-semibold text-slate-800 text-sm">
              {proposal.title}
            </p>
            <p className="text-slate-500 text-xs line-clamp-2">
              {proposal.description}
            </p>
            {proposal.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {proposal.categories.map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              <Pencil className="w-3 h-3" />
              Redigera
            </button>
          </>
        )}
      </div>
    </div>
  );
}
