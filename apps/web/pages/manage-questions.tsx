import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Calendar, ArrowLeft, Sparkles } from "lucide-react";
import { GEOGRAPHIC_CATEGORIES, THEMATIC_CATEGORIES } from "@repo/types";
import { fetchWithCsrf } from "../lib/fetch-with-csrf";
import { useConfig } from "../lib/contexts/ConfigContext";
import { useTranslation } from "../lib/hooks/useTranslation";

export default function ManageQuestionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme } = useConfig();
  const { t } = useTranslation();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.replace("/login");
    else if (!session.user?.isAdmin && !session.user?.isSuperAdmin)
      router.replace("/");
  }, [status, session, router]);

  if (status === "loading") return <div className="p-8">Loading…</div>;
  if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) return null;

  const primaryColor = theme?.primaryColor || "#00236a";
  const primaryDark = theme?.primaryDark || "#001440";
  const accentColor = theme?.accentColor || "#fbbf24";

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="text-white p-4 sm:p-6 shadow-lg"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                <Calendar className="w-6 h-6" style={{ color: primaryDark }} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold wrap-break-word">
                  {t("nav.manageQuestions") || "Manage Questions"}
                </h1>
                <p className="text-primary-100 text-xs sm:text-sm wrap-break-word">
                  {t("manageQuestions.subtitle") ||
                    "Create and manage Ja/Nej questions for the mobile app"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/manage-sessions")}
                className="text-white/80 hover:text-white font-medium whitespace-nowrap text-sm underline underline-offset-2"
              >
                Webapp-sessioner →
              </button>
              <button
                onClick={() => router.push("/")}
                className="text-white hover:opacity-80 font-medium whitespace-nowrap flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("common.backToHome") || "Back to home"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <QuestionsPanel />
      </main>
    </div>
  );
}

function QuestionsPanel() {
  const { data: session } = useSession();
  const { theme } = useConfig();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [imageUploading, setImageUploading] = useState<Record<string, boolean>>(
    {},
  );
  const [questionImages, setQuestionImages] = useState<Record<string, string>>(
    {},
  );

  const accentColor = theme?.accentColor || "#fbbf24";
  const primaryDark = theme?.primaryDark || "#001440";

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/questions");
      if (res.ok) {
        const data = await res.json();
        setQuestions(Array.isArray(data) ? data : []);
      } else {
        console.error("Error loading questions:", res.status);
        setQuestions([]);
      }
    } catch (error) {
      console.error("Error loading questions:", error);
      setQuestions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const suggestCategories = async () => {
    if (!newText.trim()) return;
    setSuggesting(true);
    try {
      const res = await fetchWithCsrf("/api/admin/suggest-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
      }
    } catch {
      // fail silently
    } finally {
      setSuggesting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const uploadImage = async (questionId: string, file: File) => {
    setImageUploading((prev) => ({ ...prev, [questionId]: true }));
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("questionId", questionId);
      const res = await fetch("/api/admin/question-image", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const { imageUrl } = await res.json();
        setQuestionImages((prev) => ({ ...prev, [questionId]: imageUrl }));
      } else {
        alert("Kunde inte ladda upp bilden");
      }
    } catch {
      alert("Uppladdning misslyckades");
    } finally {
      setImageUploading((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const createQuestion = async () => {
    if (!newText.trim()) {
      setMessage("Frågetext krävs");
      return;
    }
    if (!newDeadline) {
      setMessage("Deadline krävs");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const res = await fetchWithCsrf("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newText.trim(),
          deadline: newDeadline,
          categories,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage("Frågan skapades!");

        if (newImage) {
          await uploadImage(data._id, newImage);
          setNewImage(null);
        }

        loadQuestions();
        setNewText("");
        setNewDeadline("");
        setCategories([]);
        setTimeout(() => setMessage(""), 3000);
      } else {
        const error = await res.json();
        setMessage(`Fel: ${error.error}`);
      }
    } catch (error) {
      console.error("Error creating question:", error);
      setMessage("Kunde inte skapa frågan");
    }

    setCreating(false);
  };

  const closeQuestion = async (questionId: string) => {
    if (
      !confirm(
        "Är du säker på att du vill stänga den här frågan? Den slutar då gå att rösta eller kommentera på.",
      )
    ) {
      return;
    }

    try {
      const res = await fetchWithCsrf("/api/admin/close-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });

      if (res.ok) {
        loadQuestions();
      } else {
        const error = await res.json();
        alert(`Fel: ${error.error}`);
      }
    } catch (error) {
      console.error("Error closing question:", error);
      alert("Kunde inte stänga frågan");
    }
  };

  if (loading)
    return <div className="p-6 bg-white rounded-2xl shadow-lg">Loading…</div>;

  // Municipal-spawned questions (meetingId set) are managed via
  // /admin/my-questions/municipal instead — only show standalone questions here.
  const standaloneQuestions = questions.filter((q: any) => !q.meetingId);
  const activeQuestions = standaloneQuestions.filter(
    (q: any) => q.status === "active",
  );
  const closedQuestions = standaloneQuestions.filter(
    (q: any) => q.status !== "active",
  );

  return (
    <div className="space-y-6">
      {!session?.user?.isSuperAdmin && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> You can only see and manage questions that
            you created.
          </p>
        </div>
      )}

      <section className="bg-white rounded-2xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-6" style={{ color: primaryDark }}>
          Ny fråga
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Fråga (max 300 tecken)
            </label>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              maxLength={300}
              className="w-full border-2 border-green-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
              placeholder="t.ex. 'Ska Vallentuna bygga fler cykelbanor?'"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">
                Kategorier{" "}
                <span className="font-normal text-slate-400">
                  (valfritt, max 3)
                </span>
              </label>
              <button
                type="button"
                onClick={suggestCategories}
                disabled={!newText.trim() || suggesting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: primaryDark,
                  color: primaryDark,
                  backgroundColor: "#f0f4ff",
                }}
              >
                <Sparkles className="w-3 h-3" />
                {suggesting ? "Tänker…" : "XAI föreslår"}
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Avgör vilka användare som får push-notiser om detta innehåll.
            </p>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Plats
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {GEOGRAPHIC_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all"
                  style={
                    categories.includes(cat)
                      ? {
                          backgroundColor: primaryDark,
                          borderColor: primaryDark,
                          color: "#fff",
                        }
                      : {
                          backgroundColor: "#f9fafb",
                          borderColor: "#d1d5db",
                          color: "#555",
                        }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Ämne
            </p>
            <div className="flex flex-wrap gap-2">
              {THEMATIC_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="px-3 py-1 text-xs font-semibold rounded-full border-2 transition-all"
                  style={
                    categories.includes(cat)
                      ? {
                          backgroundColor: primaryDark,
                          borderColor: primaryDark,
                          color: "#fff",
                        }
                      : {
                          backgroundColor: "#f9fafb",
                          borderColor: "#d1d5db",
                          color: "#555",
                        }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
            <label className="block text-sm font-semibold text-green-800 mb-2">
              Deadline (sista dag frågan är aktiv) *
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="w-full border-2 border-green-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-green-700 mt-2">
              Frågan stängs automatiskt vid slutet av valt datum. Den stängs
              aldrig av en generell tidsgräns.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Bakgrundsbild (valfri)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewImage(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
            {newImage && (
              <p className="text-xs text-green-600 mt-1">✓ {newImage.name}</p>
            )}
          </div>

          <button
            onClick={createQuestion}
            disabled={creating || !newDeadline || !newText.trim()}
            className="px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
            style={{
              backgroundColor: accentColor,
              color: primaryDark,
            }}
          >
            {creating ? "Skapar..." : "Skapa fråga"}
          </button>

          {message && (
            <div
              className={`p-4 rounded-xl font-medium ${
                message.startsWith("Fel")
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </section>

      {activeQuestions.length > 0 && (
        <section className="bg-white rounded-2xl p-6 shadow-lg">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: primaryDark }}
          >
            Aktiva frågor ({activeQuestions.length})
          </h2>
          <div className="space-y-4">
            {activeQuestions.map((q: any) => (
              <div
                key={q._id}
                className="p-5 border-2 border-green-300 bg-green-50 rounded-xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3
                      className="font-bold text-xl wrap-break-word"
                      style={{ color: primaryDark }}
                    >
                      {q.text}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Deadline:{" "}
                      {new Date(q.deadline).toLocaleDateString("sv-SE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p
                      className="text-sm font-bold mt-2"
                      style={{ color: primaryDark }}
                    >
                      Ja {q.voteCounts?.ja ?? 0} / Nej {q.voteCounts?.nej ?? 0}
                    </p>

                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        Omslagsbild (visas i mobilappen)
                      </p>
                      {(questionImages[q._id] || q.imageUrl) && (
                        <img
                          src={questionImages[q._id] || q.imageUrl}
                          alt="Omslagsbild"
                          className="w-full max-w-xs h-24 object-cover rounded-lg mb-2"
                        />
                      )}
                      <label
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-opacity ${imageUploading[q._id] ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"}`}
                        style={{
                          backgroundColor: accentColor,
                          color: primaryDark,
                        }}
                      >
                        {imageUploading[q._id] ? "Laddar upp…" : "Välj bild"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={!!imageUploading[q._id]}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadImage(q._id, file);
                          }}
                        />
                      </label>
                    </div>

                    {session?.user?.isSuperAdmin &&
                      q.createdBy &&
                      q.createdBy !== "other" && (
                        <p className="text-xs text-slate-500 mt-2">
                          Skapad av:{" "}
                          {typeof q.createdBy === "object"
                            ? q.createdBy.name
                            : q.createdBy}
                        </p>
                      )}
                  </div>
                  <button
                    onClick={() => closeQuestion(q._id)}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold shadow-md hover:shadow-lg transition-all shrink-0"
                  >
                    Stäng fråga
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: primaryDark }}>
            Stängda frågor
          </h2>
          {!session?.user?.isSuperAdmin && closedQuestions.length > 0 && (
            <p className="text-xs text-slate-500">Endast dina frågor</p>
          )}
        </div>
        {closedQuestions.length > 0 ? (
          <div className="space-y-3">
            {closedQuestions.map((q: any) => (
              <div
                key={q._id}
                className="p-4 border-2 border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
              >
                <h3
                  className="font-bold text-lg wrap-break-word"
                  style={{ color: primaryDark }}
                >
                  {q.text}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Ja {q.voteCounts?.ja ?? 0} / Nej {q.voteCounts?.nej ?? 0}
                </p>
                {q.closedAt && (
                  <p className="text-sm text-slate-500">
                    Stängd:{" "}
                    {new Date(q.closedAt).toLocaleString("sv-SE", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Inga stängda frågor</p>
        )}
      </section>
    </div>
  );
}
