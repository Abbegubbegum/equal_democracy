import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../lib/api";
import { setItem, STORAGE_SELECTED_QUESTION } from "../../lib/storage";
import type { VotingSession, VotingQuota } from "../../lib/VotingQuestionCard";
import LoadingLoop from "../../lib/LoadingLoop";

const BLUE = "#002d75";
const YELLOW = "#f5a623";
// Neutral blur shown instantly while a remote card image downloads (first view
// only — expo-image's disk cache serves it with no network on later starts).
const BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";
const CARD_HEIGHT = Math.round(Dimensions.get("window").width * 0.78);
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [sessions, setSessions] = useState<VotingSession[]>([]);
  const [quota, setQuota] = useState<VotingQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  function scrollToTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    if (!hasLoadedRef.current) setLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient<{
        questions: VotingSession[];
        quota: VotingQuota;
      }>("/api/mobile/questions");
      const available = (data.questions ?? []).filter(
        (s) => s.isActive && !s.userVote,
      );
      setSessions(available);
      setQuota(data.quota ?? null);
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }

  async function handleSelect(sessionId: string) {
    await setItem(STORAGE_SELECTED_QUESTION, sessionId);
    navigation.navigate("vote");
  }

  function imageUri(s: VotingSession): string | null {
    if (!s.imageUrl) return null;
    return s.imageUrl.startsWith("http")
      ? s.imageUrl
      : `${BASE_URL}${s.imageUrl}`;
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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.feed, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.feedTitle}>Välj en fråga att rösta på</Text>
        {quota && (
          <Text style={styles.quotaLine}>
            {quota.limit - quota.used} av {quota.limit} röster kvar
          </Text>
        )}

        {sessions.map((s) => {
          const uri = imageUri(s);
          return (
            <View key={s.id} style={styles.card}>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                  placeholder={{ blurhash: BLURHASH }}
                />
              ) : (
                <View
                  style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]}
                />
              )}
              <View style={styles.cardTint} />
              <View style={styles.cardBottom}>
                <Text style={styles.cardQuestion}>{s.text}</Text>
                <TouchableOpacity
                  style={styles.väljBtn}
                  onPress={() => handleSelect(s.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.väljText}>Välj</Text>
                  <Ionicons
                    name="arrow-forward-circle"
                    size={20}
                    color={BLUE}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Permanent "last card" — copies the question-card layout; its Välj
            button jumps straight back to the top question */}
        <View style={styles.card}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },

  feed: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  feedTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  quotaLine: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: -4,
  },

  card: {
    height: CARD_HEIGHT,
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
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  cardQuestion: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25,
    marginBottom: 14,
  },
  väljBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: YELLOW,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
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
