import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  expensePostRange,
  incomePostRange,
  isTaxIncome,
  isUnderfunded,
  taxIncomeRange,
} from "@repo/types";
import {
  fetchActiveBudget,
  fetchMyBudgetVote,
  saveBudgetVote,
  formatSek,
  type BudgetSessionSummary,
} from "./budget";
import { ApiError } from "./api";
import BudgetTreemap, { type BudgetViewMode } from "./BudgetTreemap";
import BudgetPostCard, { type BudgetPostView } from "./BudgetPostCard";
import { useAuth } from "./auth-context";
import { useActionGate } from "./RestrictedNotice";
import LoadingLoop from "./LoadingLoop";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

/** Expense amounts and income amounts (+ tax rate for the tax post), by post id. */
type Draft = {
  expenses: Record<string, number>;
  income: Record<string, { amount?: number; taxRateKr?: number }>;
};

/** The server's validation errors, in the web's Swedish wording. */
/** Same wording as the web (budget.validation.underfunded). */
function underfundedMessage(deficitMnkr: string): string {
  return `Budgeten är underfinansierad: utgifterna överstiger intäkterna med ${deficitMnkr} mnkr. Minska utgifterna eller öka intäkterna innan du lämnar förslaget.`;
}

function describeErrors(e: unknown): string {
  if (e instanceof ApiError) {
    const errors = e.body?.errors;
    if (Array.isArray(errors) && errors.length) {
      return errors
        .map((x: any) =>
          x?.key === "budget.validation.belowMinimum"
            ? `${x.params.category}: Beloppet ${x.params.amount} mnkr är under minimum ${x.params.minimum} mnkr`
            : x?.key === "budget.validation.underfunded"
              ? underfundedMessage(x.params.deficit)
              : typeof x === "string"
                ? x
                : (x?.key ?? ""),
        )
        .join("\n");
    }
    return e.message;
  }
  return "Kunde inte spara budgetförslaget. Försök igen.";
}

/**
 * The budget module as shown on the Rösta tab, reached from the budget card on
 * Hem — the mobile counterpart of the web's /budget/[sessionId]: the budget
 * diagram on top, the posts below in the web's order, each unfolding into an
 * image card with an amber slider, and "Lämna budgetförslag" at the bottom.
 *
 * Slider ranges come from the rules shared with the web and the server
 * (packages/types/src/budget-rules.ts), and saving goes through the web's own
 * POST /api/budget/vote — the app adds no budget logic of its own.
 */
export default function BudgetModule({
  sessionId,
  onUnselect,
}: {
  sessionId: string;
  onUnselect: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { requireAct, gate } = useActionGate();
  const [budget, setBudget] = useState<BudgetSessionSummary | null>(null);
  const [draft, setDraft] = useState<Draft>({ expenses: {}, income: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<BudgetViewMode>("expenses-focus");
  // A post tapped in the diagram moves to the top of its list, as on the web.
  const [priorityId, setPriorityId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const postsY = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const active = await fetchActiveBudget();
      // Only one budget process runs at a time; a selection pointing at any
      // other session means the one picked on Hem has since closed.
      const current = active?.sessionId === sessionId ? active : null;
      setBudget(current);
      // Start from the user's saved proposal when there is one, otherwise
      // from the municipality's own figures (the posts' defaults).
      const vote = current && user ? await fetchMyBudgetVote(sessionId) : null;
      setDraft({
        expenses: Object.fromEntries(
          (vote?.allocations ?? []).map((a) => [a.categoryId, a.amount]),
        ),
        income: Object.fromEntries(
          (vote?.incomeAllocations ?? []).map((a) => [
            a.categoryId,
            { amount: a.amount, taxRateKr: a.taxRateKr },
          ]),
        ),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const expenses: BudgetPostView[] = useMemo(
    () =>
      (budget?.categories ?? []).map((c) => {
        const range = expensePostRange(c);
        const amount = draft.expenses[c.id] ?? range.default;
        return {
          id: c.id,
          kind: "expense",
          name: c.name,
          imageUrl: c.imageUrl,
          color: c.color,
          amount,
          slider: { ...range, value: amount },
        };
      }),
    [budget, draft],
  );

  const income: BudgetPostView[] = useMemo(
    () =>
      (budget?.incomeCategories ?? []).map((c) => {
        const saved = draft.income[c.id];
        if (isTaxIncome(c) && budget) {
          // The tax post is set as a tax rate; the amount follows from it.
          const t = taxIncomeRange(c, budget);
          const rate = saved?.taxRateKr ?? t.defaultRate;
          return {
            id: c.id,
            kind: "income",
            name: c.name,
            imageUrl: c.imageUrl,
            color: c.color,
            amount: rate * t.taxBase,
            taxRate: true,
            slider: {
              value: rate,
              min: t.minRate,
              max: t.maxRate,
              step: t.rateStep,
              default: t.defaultRate,
            },
          };
        }
        const range = incomePostRange(c);
        const amount = saved?.amount ?? range.default;
        return {
          id: c.id,
          kind: "income",
          name: c.name,
          imageUrl: c.imageUrl,
          color: c.color,
          amount,
          slider: { ...range, value: amount },
        };
      }),
    [budget, draft],
  );

  function updatePost(post: BudgetPostView, sliderValue: number) {
    setSaveResult(null);
    setDraft((prev) => {
      if (post.kind === "expense") {
        return {
          ...prev,
          expenses: { ...prev.expenses, [post.id]: sliderValue },
        };
      }
      const value = post.taxRate
        ? { taxRateKr: sliderValue }
        : { amount: sliderValue };
      return { ...prev, income: { ...prev.income, [post.id]: value } };
    });
  }

  function handleDiagramPress(id: string) {
    setPriorityId(id);
    setExpandedId(id);
    scrollRef.current?.scrollTo({ y: postsY.current - 12, animated: true });
  }

  async function handleSave() {
    // Readable by anyone; proposing needs a verified participant. The server
    // refuses too (requireParticipant) — this just says so up front.
    if (!requireAct() || !budget || saving) return;

    // A proposal may not spend more than it raises. The server refuses too
    // (validateBudgetVote); checking here just answers without a round trip.
    const balance =
      income.reduce((s, p) => s + p.amount, 0) -
      expenses.reduce((s, p) => s + p.amount, 0);
    if (isUnderfunded(balance)) {
      setSaveResult({
        ok: false,
        message: underfundedMessage((-balance / 1_000_000).toFixed(1)),
      });
      return;
    }

    setSaving(true);
    setSaveResult(null);
    try {
      await saveBudgetVote(budget.sessionId, {
        allocations: expenses.map((p) => ({
          categoryId: p.id,
          amount: Math.round(p.amount),
        })),
        incomeAllocations: income.map((p) => ({
          categoryId: p.id,
          amount: Math.round(p.amount),
          ...(p.taxRate ? { taxRateKr: p.slider.value } : {}),
        })),
      });
      setSaveResult({ ok: true, message: "Ditt budgetförslag är sparat." });
    } catch (e) {
      setSaveResult({ ok: false, message: describeErrors(e) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingLoop />;

  const prioritized = (posts: BudgetPostView[]) =>
    [...posts].sort((a, b) =>
      a.id === priorityId ? -1 : b.id === priorityId ? 1 : 0,
    );

  const section = (title: string, posts: BudgetPostView[]) => (
    <View key={title} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {prioritized(posts).map((p) => (
        <BudgetPostCard
          key={p.id}
          post={p}
          expanded={expandedId === p.id}
          onToggle={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
          onChange={(v) => updatePost(p, v)}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      {gate}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Budget</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Just clears the fixed header — nothing behind it to reveal.
            paddingTop: insets.top + 68,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {error ? (
            <>
              <Text style={styles.title}>Kunde inte hämta budgeten</Text>
              <Text style={styles.body}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={load}>
                <Text style={styles.retryText}>Försök igen</Text>
              </TouchableOpacity>
            </>
          ) : budget ? (
            <>
              <Text style={styles.eyebrow}>Kommunens budget</Text>
              <Text style={styles.title}>{budget.name}</Text>
              <Text style={styles.body}>
                {budget.municipality} · {formatSek(budget.totalBudget)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Budgetprocessen är avslutad</Text>
              <Text style={styles.body}>
                Den här budgeten går inte längre att påverka.
              </Text>
            </>
          )}

          <TouchableOpacity
            style={styles.unselectBtn}
            onPress={onUnselect}
            activeOpacity={0.75}
          >
            <Ionicons name="refresh-outline" size={16} color={BLUE} />
            <Text style={styles.unselectBtnText}>Välj något annat</Text>
          </TouchableOpacity>
        </View>

        {budget && (
          <>
            <View style={styles.card}>
              <BudgetTreemap
                expenses={expenses}
                income={income}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onPostPress={handleDiagramPress}
              />
            </View>

            <View
              style={styles.sections}
              onLayout={(e) => (postsY.current = e.nativeEvent.layout.y)}
            >
              {/* Same order as the web: the list in focus comes first. */}
              {viewMode === "income-focus"
                ? [section("Intäkter", income), section("Utgifter", expenses)]
                : [section("Utgifter", expenses), section("Intäkter", income)]}
            </View>

            {saveResult && (
              <View
                style={[
                  styles.result,
                  saveResult.ok ? styles.resultOk : styles.resultError,
                ]}
              >
                <Ionicons
                  name={saveResult.ok ? "checkmark-circle" : "alert-circle"}
                  size={18}
                  color={saveResult.ok ? "#16a34a" : "#dc2626"}
                />
                <Text style={styles.resultText}>{saveResult.message}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnBusy]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={BLUE} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={BLUE} />
                  <Text style={styles.saveText}>Lämna budgetförslag</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Solid black, like Hem: the budget is read closely, so nothing competes
  // with the diagram and the post images.
  screen: { flex: 1, backgroundColor: "#111" },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "rgba(0,45,117,0.90)",
    zIndex: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  scrollContent: { paddingHorizontal: 16, gap: 12 },

  // Matches VotingQuestionCard's card, so the budget view reads as the same
  // kind of page as a question.
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  eyebrow: {
    color: BLUE,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: { fontSize: 19, fontWeight: "800", color: "#111", lineHeight: 26 },
  body: { fontSize: 14, color: "#444", lineHeight: 20 },

  sections: { gap: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    marginLeft: 4,
  },

  result: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
  },
  resultOk: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  resultError: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  resultText: { flex: 1, fontSize: 14, color: "#1e293b", lineHeight: 20 },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveText: { color: BLUE, fontSize: 16, fontWeight: "800" },

  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: BLUE,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  unselectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  unselectBtnText: { fontSize: 13, fontWeight: "700", color: BLUE },
});
