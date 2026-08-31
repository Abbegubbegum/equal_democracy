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
import { selectQuestion } from "../../lib/selected-question";
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
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const listRef = useRef<FlatList<VotingSession>>(null);

  function scrollToTop() {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  const applyPayload = useCallback((payload: QuestionsPayload) => {
    setSessions(
      (payload.questions ?? []).filter((s) => s.isActive && !s.userVote),
    );
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
    ...StyleSheet.absoluteFillObject,
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
