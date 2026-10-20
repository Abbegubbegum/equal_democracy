import { useState, type FormEvent } from "react";
import {
  FileJson,
  FileText,
  Download,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";
import type { BudgetPreview, BudgetSpec } from "../../lib/budget/budget-spec";

/**
 * Creating a budget process in admin. Two ways in, one way through:
 *   - "Från budgetfil": a JSON budget file (data/budgets/*.json shape) —
 *     the coalition's figures plus the parties' own proposals, spans, locked
 *     posts and notes;
 *   - "Från PDF med AI": the AI extractor reads a budget PDF, and its reading
 *     is turned into the same budget file shape.
 * Either way the server builds a preview (POST /api/admin/budget-import) that
 * is reviewed here before anything is saved, and the reviewed file can be
 * downloaded, corrected and uploaded again.
 */
export default function BudgetImportForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"file" | "pdf">("file");
  const [spec, setSpec] = useState<BudgetSpec | null>(null);
  const [preview, setPreview] = useState<BudgetPreview | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");

  // PDF path inputs
  const [name, setName] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);

  async function requestPreview(next: BudgetSpec, apply = false) {
    const res = await fetchWithCsrf("/api/admin/budget-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: next, apply }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Kunde inte läsa budgeten.");
    return data.preview as BudgetPreview;
  }

  async function review(next: BudgetSpec) {
    setError("");
    setBusy("Granskar budgeten…");
    try {
      setPreview(await requestPreview(next));
      setSpec(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      review(JSON.parse(await file.text()));
    } catch {
      setError("Filen är inte giltig JSON.");
    }
  }

  async function handlePdf(e: FormEvent) {
    e.preventDefault();
    if (!pdf) return setError("Välj en PDF.");
    setError("");
    setBusy("AI läser PDF:en…");
    try {
      const form = new FormData();
      form.append("pdf", pdf);
      form.append("documentType", "expenses");
      const res = await fetch("/api/budget/upload-pdf", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Kunde inte läsa PDF:en.");
      await review(specFromExtraction(data.data, name, municipality));
    } catch (err: any) {
      setError(err.message);
      setBusy("");
    }
  }

  async function handleApply() {
    if (!spec) return;
    setError("");
    setBusy("Sparar…");
    try {
      await requestPreview(spec, true);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  function download() {
    if (!spec) return;
    const blob = new Blob([JSON.stringify(spec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preview?.sessionId || "budget"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const reset = () => {
    setSpec(null);
    setPreview(null);
    setError("");
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 mb-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Ny budgetprocess</h3>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {busy && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          {busy}
        </div>
      )}

      {preview ? (
        <Review
          preview={preview}
          busy={!!busy}
          onApply={handleApply}
          onDownload={download}
          onBack={reset}
        />
      ) : (
        <>
          <div className="flex gap-2">
            <ModeButton
              active={mode === "file"}
              onClick={() => setMode("file")}
              icon={<FileJson className="w-4 h-4" />}
              label="Från budgetfil"
            />
            <ModeButton
              active={mode === "pdf"}
              onClick={() => setMode("pdf")}
              icon={<FileText className="w-4 h-4" />}
              label="Från PDF med AI"
            />
          </div>

          {mode === "file" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                En budgetfil (JSON) innehåller kommunens förslag, partiernas
                egna förslag, reglagens spann, låsta poster och förklaringar —
                se <code>apps/web/data/budgets/</code>. Du granskar allt innan
                något sparas.
              </p>
              <input
                type="file"
                accept=".json,application/json"
                disabled={!!busy}
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
          ) : (
            <form onSubmit={handlePdf} className="space-y-3">
              <p className="text-sm text-gray-600">
                AI läser utgifter, intäkter och skattesats ur en budget-PDF
                (driftredovisningen). Partiernas förslag kommer inte med — ladda
                ner resultatet som budgetfil efter granskningen om du vill
                komplettera det.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Namn, t.ex. Budget 2028"
                required
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="Kommun, t.ex. Vallentuna"
                required
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
              />
              <button
                type="submit"
                disabled={!!busy}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                Läs PDF och granska
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={onCancel}
            disabled={!!busy}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg disabled:opacity-50"
          >
            Avbryt
          </button>
        </>
      )}
    </div>
  );
}

/** The AI extractor's reading of a PDF (amounts in kr) as a budget file. */
function specFromExtraction(
  data: any,
  name: string,
  municipality: string,
): BudgetSpec {
  const mnkr = (kr: number) => (kr || 0) / 1_000_000;
  const rate = data?.taxRateKr || undefined;
  return {
    name,
    municipality,
    taxRateKr: rate,
    // ±10% around the extracted rate, as the PDF path always did.
    minTaxRateKr: rate ? Math.round(rate * 0.9 * 100) / 100 : undefined,
    maxTaxRateKr: rate ? Math.round(rate * 1.1 * 100) / 100 : undefined,
    expenses: (data?.categories ?? []).map((c: any) => ({
      name: c.name,
      amount: mnkr(c.defaultAmount ?? c.amount),
      ...(c.minAmount ? { minAmount: mnkr(c.minAmount) } : {}),
      ...(c.isFixed ? { fixed: true } : {}),
      ...(c.subcategories?.length
        ? {
            subcategories: c.subcategories.map((s: any) => ({
              name: s.name,
              amount: mnkr(s.defaultAmount ?? s.amount),
              minAmount: mnkr(s.minAmount),
              fixed: !!s.isFixed,
            })),
          }
        : {}),
    })),
    income: (data?.incomeCategories ?? []).map((c: any) => ({
      name: c.name,
      amount: mnkr(c.amount),
      ...(c.isTaxRate || /skatt/i.test(c.name) ? { tax: true } : {}),
    })),
  };
}

function ModeButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
        active
          ? "bg-emerald-600 border-emerald-600 text-white"
          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const mnkr = (kr: number) =>
  `${(kr / 1_000_000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} mnkr`;
const kr2 = (v: number) =>
  `${v.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

const OUTCOME = {
  create: "Skapas som utkast — aktivera den sedan i listan.",
  "replace-draft": "Ersätter det befintliga utkastet.",
  "update-alternatives":
    "Budgeten är redan aktiv eller avslutad: bara partiernas förslag uppdateras.",
};

function Review({
  preview,
  busy,
  onApply,
  onDownload,
  onBack,
}: {
  preview: BudgetPreview;
  busy: boolean;
  onApply: () => void;
  onDownload: () => void;
  onBack: () => void;
}) {
  const p = preview;
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Granska innan du sparar
        </div>
        <h4 className="text-xl font-bold text-gray-900">
          {p.name} · {p.municipality}
        </h4>
        <p className="text-sm text-gray-500">
          {p.sessionId} — {OUTCOME[p.outcome]}
        </p>
      </div>

      {p.warnings.length > 0 && (
        <div className="space-y-2">
          {p.warnings.map((w) => (
            <div
              key={w}
              className="flex gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Balance per proposal — the check that matters most. */}
      <table className="w-full text-sm bg-white rounded-lg overflow-hidden">
        <thead className="bg-gray-100 text-gray-600">
          <tr>
            <th className="text-left p-2">Förslag</th>
            <th className="text-right p-2">Skattesats</th>
            <th className="text-right p-2">Balans</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t font-semibold">
            <td className="p-2">Kommunens förslag (reglagens utgångsläge)</td>
            <td className="p-2 text-right">
              {p.taxRateKr != null ? kr2(p.taxRateKr) : "–"}
            </td>
            <Balance value={p.coalition.balance} />
          </tr>
          {p.alternatives.map((a) => (
            <tr key={a.key} className="border-t">
              <td className="p-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm mr-2"
                  style={{ backgroundColor: a.color }}
                />
                {a.label} ({a.key}) · {a.posts} poster
              </td>
              <td className="p-2 text-right">
                {a.taxRateKr != null ? kr2(a.taxRateKr) : "–"}
              </td>
              <Balance value={a.balance} />
            </tr>
          ))}
        </tbody>
      </table>

      <PostTable title="Utgifter" posts={p.expenses} />
      <PostTable title="Intäkter" posts={p.income} />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onApply}
          disabled={busy}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-50"
        >
          {p.outcome === "update-alternatives"
            ? "Uppdatera partiernas förslag"
            : "Skapa budget"}
        </button>
        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg"
        >
          <Download className="w-4 h-4" />
          Ladda ner som budgetfil
        </button>
        <button
          onClick={onBack}
          disabled={busy}
          className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg disabled:opacity-50"
        >
          Börja om
        </button>
      </div>
    </div>
  );
}

function Balance({ value }: { value: number }) {
  return (
    <td
      className={`p-2 text-right font-semibold ${value < -0.5 ? "text-red-600" : "text-green-700"}`}
    >
      {value > 0 ? "+" : ""}
      {mnkr(value)}
    </td>
  );
}

function PostTable({
  title,
  posts,
}: {
  title: string;
  posts: BudgetPreview["expenses"];
}) {
  return (
    <div>
      <h5 className="font-bold text-gray-800 mb-1">{title}</h5>
      <table className="w-full text-sm bg-white rounded-lg overflow-hidden">
        <thead className="bg-gray-100 text-gray-600">
          <tr>
            <th className="text-left p-2">Post</th>
            <th className="text-right p-2">Belopp</th>
            <th className="text-right p-2">Reglage</th>
            <th className="text-left p-2">Partier</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.name} className="border-t align-top">
              <td className="p-2">
                <div className="font-medium text-gray-900">{post.name}</div>
                {post.note && (
                  <div className="text-xs text-gray-500">{post.note}</div>
                )}
              </td>
              <td className="p-2 text-right whitespace-nowrap">
                {mnkr(post.amount)}
              </td>
              <td className="p-2 text-right whitespace-nowrap text-gray-600">
                {post.locked ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> låst
                  </span>
                ) : post.tax ? (
                  `${kr2(post.min)} – ${kr2(post.max)}`
                ) : (
                  `${mnkr(post.min)} – ${mnkr(post.max)}`
                )}
              </td>
              <td className="p-2">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                  {post.parties.map((m) => (
                    <span
                      key={m.key}
                      className={`inline-flex items-center gap-1 ${m.outside ? "text-amber-700 font-semibold" : "text-gray-600"}`}
                      title={m.outside ? "Utanför reglagets spann" : undefined}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-sm"
                        style={{ backgroundColor: m.color }}
                      />
                      {m.key} {post.tax ? kr2(m.value) : mnkr(m.value)}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
