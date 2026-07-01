import { useCallback, useState } from "react";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useNavigation } from "expo-router";
import CelebrationModal from "../../lib/CelebrationModal";
import { addStars } from "../../lib/stars";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../lib/api";
import {
  getItem,
  deleteItem,
  STORAGE_SELECTED_QUESTION,
} from "../../lib/storage";
import {
  VotingQuestionCard,
  type VoteCounts,
  type VotingSession,
  type VotingQuota,
} from "../../lib/VotingQuestionCard";
import VotingDebateSection from "../../lib/VotingDebateSection";

const BLUE = "#002d75";
const YELLOW = "#f5a623";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function VoteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [sessions, setSessions] = useState<VotingSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<"ja" | "nej" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [quota, setQuota] = useState<VotingQuota | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Notifications.setBadgeCountAsync(0).catch(() => {});
      load();
    }, []),
  );

  async function load() {
    setLoading(true);
    setFetchError(null);
    try {
      const [storedId, data] = await Promise.all([
        getItem(STORAGE_SELECTED_QUESTION),
        apiClient<{ sessions: VotingSession[]; quota: VotingQuota }>(
          "/api/mobile/sessions/voting",
        ),
      ]);
      const list = data?.sessions ?? [];
      setSessions(list);
      setQuota(data?.quota ?? null);
      setSelectedId(storedId);
      if (storedId) {
        const session = list.find((s) => s.id === storedId);
        setSelected(session?.userVote ?? null);
      } else {
        setSelected(null);
      }
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  function bgUri(s: VotingSession): string | null {
    if (!s.imageUrl) return null;
    return s.imageUrl.startsWith("http")
      ? s.imageUrl
      : `${BASE_URL}${s.imageUrl}`;
  }

  async function handleVote() {
    if (!selected || !selectedSession || submitting) return;
    const isNewVote = !selectedSession.userVote;
    setSubmitting(true);
    setVoteError(null);
    try {
      const res = await apiClient<{ voteCounts: VoteCounts; userVote: string }>(
        "/api/mobile/quick-vote",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: selectedSession.id,
            choice: selected,
          }),
        },
      );
      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedSession.id
            ? {
                ...s,
                voteCounts: res.voteCounts,
                userVote: res.userVote as any,
              }
            : s,
        ),
      );
      if (isNewVote) {
        setQuota((q) => (q ? { ...q, used: q.used + 1 } : q));
      }
      await addStars(1);
      setCelebration(true);
    } catch (e: any) {
      setVoteError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnselect() {
    await deleteItem(STORAGE_SELECTED_QUESTION);
    setSelectedId(null);
    setSelected(null);
    navigation.navigate("index");
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
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

  // No question selected → prompt to go choose one on Hem
  if (!selectedSession) {
    return (
      <View style={styles.emptyScreen}>
        <StatusBar barStyle="light-content" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} />
        <View style={styles.emptyContent}>
          <View style={[styles.emptyIconWrap, { marginTop: insets.top + 32 }]}>
            <Ionicons name="hand-left-outline" size={48} color={YELLOW} />
          </View>
          <Text style={styles.emptyTitle}>Välj en fråga</Text>
          <Text style={styles.emptyText}>
            Gå till Hem och välj vilken fråga du vill debattera och rösta på. Du
            kan ångra valet ända tills du har röstat.
          </Text>
          <TouchableOpacity
            style={styles.goHemBtn}
            onPress={() => navigation.navigate("index")}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back-circle-outline" size={18} color={BLUE} />
            <Text style={styles.goHemText}>Välj på Hem-fliken</Text>
          </TouchableOpacity>
        </View>
        <CelebrationModal
          visible={celebration}
          title="Bra röstat!"
          subtitle="Du tränar ditt omdöme och bidrar till demokratin. Varje röst räknas!"
          stars={1}
          onDone={() => setCelebration(false)}
        />
      </View>
    );
  }

  const uri = bgUri(selectedSession);
  const hasVoted = !!selectedSession.userVote;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* Background from selected session's image */}
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.bgOverlay]} />

      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>
          {hasVoted ? "Din röst" : "Rösta"}
        </Text>
        {quota && (
          <Text style={styles.quotaText}>
            Du har röstat i {quota.used} av {quota.limit} möjliga frågor
          </Text>
        )}
        {!!voteError && <Text style={styles.voteErrorText}>{voteError}</Text>}
      </View>

      {/* Scrollable card + debate */}
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Extra top padding so the background image's top edge is
            // visible above the card, instead of the card sitting right
            // under the fixed header.
            paddingTop: insets.top + 260,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <VotingQuestionCard
          session={selectedSession}
          selected={selected}
          onSelect={setSelected}
          onVote={handleVote}
          submitting={submitting}
          onUnselect={handleUnselect}
        />

        <VotingDebateSection
          sessionId={selectedSession.id}
          canPost={selectedSession.isActive}
        />
      </ScrollView>

      <CelebrationModal
        visible={celebration}
        title="Bra röstat!"
        subtitle="Du tränar ditt omdöme och bidrar till demokratin. Varje röst räknas!"
        stars={1}
        onDone={() => setCelebration(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bgOverlay: { backgroundColor: "rgba(0,0,20,0.52)" },

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
  quotaText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  voteErrorText: {
    color: "#fecaca",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },

  scrollContent: { paddingHorizontal: 16, gap: 12 },

  // Empty state (no selection)
  emptyScreen: { flex: 1 },
  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  emptyText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  goHemBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: YELLOW,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  goHemText: { color: BLUE, fontSize: 15, fontWeight: "800" },

  // Error / loading
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f4f6fb",
    paddingHorizontal: 32,
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
