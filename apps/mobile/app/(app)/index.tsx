import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { selectQuestion, selectBudget } from "../../lib/selection";
import {
  fetchActiveBudget,
  fetchLatestBudgetResult,
  formatSek,
  formatMnkr,
  formatTaxRate,
  type BudgetSessionSummary,
  type BudgetResultSummary,
} from "../../lib/budget";
import type { VotingSession, VotingQuota } from "../../lib/VotingQuestionCard";
import {
  fetchQuestions,
  getCachedQuestions,
  onQuestionsChange,
  type QuestionsPayload,
} from "../../lib/questions-cache";
import LoadingLoop from "../../lib/LoadingLoop";

const BLUE = "#002d75";
const YELLOW = "#f5a623";
// Neutral blur shown instantly while a remote card image downloads (first view
// only — expo-image's disk cache serves it with no network on later starts).
const BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";
const CARD_HEIGHT = Math.round(Dimensions.get("window").width * 0.78);
const CARD_GAP = 16;
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const BUDGET_IMAGE = require("../../assets/budget-scale.jpg");

function imageUri(s: VotingSession): string | null {
  if (!s.imageUrl) return null;
  return s.imageUrl.startsWith("http")
    ? s.imageUrl
    : `${BASE_URL}${s.imageUrl}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [sessions, setSessions] = useState<VotingSession[]>([]);
  const [quota, setQuota] = useState<VotingQuota | null>(null);
  // Every currently-closed question, kept around purely as filler: shown only
  // once `sessions` above is empty, so the tab is never blank between rounds.
  // Political questions are often decided in a batch at the same meeting, so
  // this is deliberately not just the single latest one — all of them stay
  // visible together until a new active question is published, which is what
  // empties `sessions` again and hides this list.
  const [closedResults, setClosedResults] = useState<VotingSession[]>([]);
  // The one active budget process, if any — shown as its own card at the top
  // of every Hem state (feed or "Du är à jour"), since it stays current
  // regardless of how many questions the user has voted on.
  const [budget, setBudget] = useState<BudgetSessionSummary | null>(null);
  // Between budget rounds: the latest closed budget's collective result, in
  // the budget card's place — the same "results stay until the next round"
  // rule as closed questions. Never shown while a budget is active.
  const [budgetResult, setBudgetResult] = useState<BudgetResultSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const listRef = useRef<FlatList<VotingSession>>(null);

  function scrollToTop() {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  const applyPayload = useCallback((payload: QuestionsPayload) => {
    const all = payload.questions ?? [];
    setSessions(all.filter((s) => s.isActive && !s.userVote));
    // The API already returns closed questions newest-closed-first — kept in
    // that order here too.
    setClosedResults(all.filter((s) => !s.isActive));
    setQuota(payload.quota ?? null);
  }, []);

  // Rösta writes a cast vote straight into the cache, so the question it was
  // cast on leaves this feed without a refetch.
  useEffect(() => onQuestionsChange(applyPayload), [applyPayload]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    // Independent of the question feed: a budget fetch failing just means no
    // budget card, never an error screen over the questions.
    fetchActiveBudget()
      .then(async (active) => {
        setBudget(active);
        setBudgetResult(active ? null : await fetchLatestBudgetResult());
      })
      .catch(() => {});

    // Render whatever the cache holds first — the spinner is only for a genuine
    // cold start, never for a refocus that already has data to show.
    const cached = getCachedQuestions();
    if (cached) {
      applyPayload(cached);
      setLoading(false);
    }
    setFetchError(null);
    try {
      applyPayload(await fetchQuestions());
    } catch (e: any) {
      // A failed background revalidation must not blank out good cached data.
      if (!getCachedQuestions()) setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSelect = useCallback(
    async (sessionId: string) => {
      await selectQuestion(sessionId);
      navigation.navigate("vote");
    },
    [navigation],
  );

  const handleOpenBudget = useCallback(
    async (sessionId: string) => {
      await selectBudget(sessionId);
      navigation.navigate("vote");
    },
    [navigation],
  );

  // Entry point to the budget module. Same card shape as a question card, with
  // the bundled balance-scale illustration as its fixed image.
  function renderBudgetCard(b: BudgetSessionSummary) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpenBudget(b.sessionId)}
        activeOpacity={0.9}
      >
        <Image
          source={BUDGET_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <View style={styles.cardTint} />
        <View style={styles.cardBottom}>
          <Text style={styles.resultEyebrow}>Kommunens budget</Text>
          <Text style={styles.cardQuestion}>{b.name}</Text>
          <View style={styles.väljBtn}>
            <Text style={styles.väljText}>Gör din budget</Text>
            <Ionicons name="arrow-forward-circle" size={20} color={BLUE} />
          </View>
          <Text style={styles.resultStats}>
            {b.municipality} · {formatSek(b.totalBudget)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Non-interactive twin of the budget card for a closed budget, laid out like
  // a closed question's result card: eyebrow, name, one amber pill with the
  // outcome (the collective tax rate), and the totals.
  function renderBudgetResultCard(r: BudgetResultSummary) {
    return (
      <View style={styles.card}>
        <Image
          source={BUDGET_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <View style={styles.cardTint} />
        <View style={styles.cardBottom}>
          <Text style={styles.resultEyebrow}>Budgetresultat</Text>
          <Text style={styles.cardQuestion}>{r.session.name}</Text>
          {r.taxRateKr != null && (
            <View style={styles.väljBtn}>
              <Text style={styles.väljText}>{formatTaxRate(r.taxRateKr)}</Text>
              <Ionicons name="checkmark-circle" size={20} color={BLUE} />
            </View>
          )}
          <Text style={styles.resultStats}>
            {r.voterCount} budgetförslag · Totala intäkter{" "}
            {formatMnkr(r.totalIncome)}
          </Text>
        </View>
      </View>
    );
  }

  // The top-of-Hem budget slot: the active budget, else the latest result.
  const budgetSlot = budget
    ? renderBudgetCard(budget)
    : budgetResult
      ? renderBudgetResultCard(budgetResult)
      : null;

  const renderCard = useCallback(
    ({ item }: { item: VotingSession }) => {
      const uri = imageUri(item);
      return (
        <View style={styles.card}>
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              placeholder={{ blurhash: BLURHASH }}
              recyclingKey={item.id}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]}
            />
          )}
          <View style={styles.cardTint} />
          <View style={styles.cardBottom}>
            <Text style={styles.cardQuestion}>{item.text}</Text>
            <TouchableOpacity
              style={styles.väljBtn}
              onPress={() => handleSelect(item.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.väljText}>Välj</Text>
              <Ionicons name="arrow-forward-circle" size={20} color={BLUE} />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [handleSelect],
  );

  // Non-interactive twin of renderCard's bottom panel: the winning side alone
  // (matching the request — "the button the majority voted for stands
  // alone"), no Välj button since the question is closed and can't be acted
  // on. Reuses väljBtn/väljText for the pill so it stays the same amber
  // "button" look, just as a plain View instead of a TouchableOpacity.
  function renderResultCard(item: VotingSession) {
    const uri = imageUri(item);
    const { ja, nej } = item.voteCounts;
    const total = ja + nej;
    const jaPct = total === 0 ? 0 : Math.round((ja / total) * 100);
    const nejPct = total === 0 ? 0 : 100 - jaPct;
    const winner = ja === nej ? "Oavgjort" : ja > nej ? "Ja" : "Nej";

    return (
      <View style={styles.card}>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: BLURHASH }}
            recyclingKey={item.id}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} />
        )}
        <View style={styles.cardTint} />
        <View style={styles.cardBottom}>
          <Text style={styles.resultEyebrow}>Omröstningsresultat</Text>
          <Text style={styles.cardQuestion}>{item.text}</Text>
          <View style={styles.väljBtn}>
            <Text style={styles.väljText}>{winner}</Text>
            <Ionicons name="checkmark-circle" size={20} color={BLUE} />
          </View>
          <Text style={styles.resultStats}>
            {total} röstande · {jaPct}% Ja · {nejPct}% Nej
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return <LoadingLoop />;
  }

  if (fetchError) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={styles.errorText}>{fetchError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Försök igen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sessions.length === 0) {
    // Nothing to show at all — no closed question to fall back on (a
    // brand-new deployment) and nothing in the budget slot — the original plain
    // empty state.
    if (closedResults.length === 0 && !budgetSlot) {
      return (
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Ionicons name="checkmark-circle-outline" size={56} color="#16a34a" />
          <Text style={styles.emptyTitle}>Du är à jour!</Text>
          <Text style={styles.emptyText}>
            {quota && quota.used > 0
              ? `Du har röstat i ${quota.used} av ${quota.limit} frågor. Kom tillbaka när nästa fråga publiceras.`
              : "Inga aktiva frågor just nu. Kom tillbaka snart."}
          </Text>
        </View>
      );
    }

    // Otherwise: the same message, followed by every currently-closed question
    // as a result card instead of leaving the tab blank. A FlatList (not a
    // ScrollView) for the same reason as the main feed below — a batch of
    // closed questions from one meeting is still a list of full-bleed remote
    // images, and windowing is what keeps them from all downloading at once.
    // The whole list disappears again the instant a new active question shows
    // up in `sessions`.
    return (
      <View style={styles.screen}>
        <FlatList
          data={closedResults}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => renderResultCard(item)}
          contentContainerStyle={[styles.feed, { paddingTop: insets.top + 20 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.resultHeader}>
              <Ionicons
                name="checkmark-circle-outline"
                size={40}
                color="#16a34a"
              />
              <Text style={styles.emptyTitle}>Du är à jour!</Text>
              <Text style={styles.emptyText}>
                {quota && quota.used > 0
                  ? `Du har röstat i ${quota.used} av ${quota.limit} frågor. Kom tillbaka när nästa fråga publiceras.`
                  : "Inga aktiva frågor just nu. Kom tillbaka snart."}
              </Text>
              {budgetSlot && (
                <View style={styles.resultHeaderBudget}>{budgetSlot}</View>
              )}
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={sessions}
        keyExtractor={(s) => s.id}
        renderItem={renderCard}
        contentContainerStyle={[styles.feed, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        // Every card is a full-bleed remote image. Rendering the whole feed at
        // once (as the previous ScrollView did) mounted every <Image> upfront
        // and kicked off one download per active question simultaneously, all
        // competing for the same connection. Windowing keeps that to the cards
        // near the viewport, which is what makes images load as they come into
        // view rather than all at once.
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={styles.feedHeader}>
            <Text style={styles.feedTitle}>Välj en fråga att rösta på</Text>
            {/* Only for someone who has a quota to spend. The endpoint returns
                null for a signed-out visitor, so this does not render for them
                — "0 av 5" read as an invitation they cannot accept. */}
            {quota && (
              <Text style={styles.quotaLine}>
                {quota.limit - quota.used} av {quota.limit} röster kvar
              </Text>
            )}
            {budgetSlot && (
              <View style={styles.feedHeaderBudget}>{budgetSlot}</View>
            )}
          </View>
        }
        // Permanent "last card" — copies the question-card layout; its Välj
        // button jumps straight back to the top question.
        ListFooterComponent={
          <View style={styles.card}>
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]}
            />
            <View style={styles.cardTint} />
            <View style={styles.cardBottom}>
              <Text style={styles.cardQuestion}>
                Ska vi gå tillbaka till toppen?
              </Text>
              <TouchableOpacity
                style={styles.väljBtn}
                onPress={scrollToTop}
                activeOpacity={0.85}
              >
                <Text style={styles.väljText}>Välj</Text>
                <Ionicons name="arrow-up-circle" size={20} color={BLUE} />
              </TouchableOpacity>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },

  feed: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  // Spacing lives on the card rather than as a container `gap`: a FlatList
  // measures each row, and a gap sits outside the row it separates.
  feedHeader: {
    gap: 4,
    marginBottom: CARD_GAP,
  },
  quotaLine: { color: "#9aa4b2", fontSize: 13, fontWeight: "600" },
  feedTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },

  card: {
    height: CARD_HEIGHT,
    marginBottom: CARD_GAP,
    borderRadius: 20,
    overflow: "hidden",
  },
  cardTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  cardBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 44,
  },
  // No dark panel behind the text anymore — legibility comes from the text
  // shadow below instead, so the image stays visible all the way to the edge.
  cardQuestion: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25,
    marginBottom: 14,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  // Same idea for the button: a dark drop shadow (+ a hairline dark outline
  // for the case the image behind it is itself pale amber/yellow) instead of
  // sitting on a dark field, so it still pops against a bright photo.
  väljBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: YELLOW,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  väljText: { color: BLUE, fontSize: 15, fontWeight: "800" },

  // "Du är à jour" header shown above the filler result card — same copy as
  // `center`'s empty state but top-aligned (not flex-centered) since a card
  // follows it.
  resultHeader: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  // The budget card sits inside a list header; its own marginBottom (from
  // `card`) separates it from the first list item, these give it room above.
  feedHeaderBudget: { marginTop: CARD_GAP - 4, marginBottom: -CARD_GAP },
  // Cancels resultHeader's horizontal padding so the card is full feed width.
  resultHeaderBudget: {
    alignSelf: "stretch",
    marginHorizontal: -16,
    marginTop: 20,
  },
  resultEyebrow: {
    color: YELLOW,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  resultStats: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#111",
    paddingHorizontal: 32,
  },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  retryBtn: {
    backgroundColor: BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
});
