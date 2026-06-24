import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { INTEREST_AREAS, INTEREST_TO_CATEGORIES } from "@repo/types";
import { apiClient } from "../../lib/api";
import { getItem } from "../../lib/storage";
import { STORAGE_INTERESTS, SettingsModal } from "../../lib/SettingsModal";
import {
  VotingQuestionCard,
  type VotingSession,
  type VoteCounts,
} from "../../lib/VotingQuestionCard";
import {
  SessionQuestionCard,
  type SessionQuestion,
} from "../../lib/SessionQuestionCard";
import CelebrationModal from "../../lib/CelebrationModal";
import { addStars } from "../../lib/stars";

const BLUE = "#002d75";

export default function MyQuestionsScreen() {
  const insets = useSafeAreaInsets();
  const [tabs, setTabs] = useState<(typeof INTEREST_AREAS)[number][]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [sessions, setSessions] = useState<VotingSession[]>([]);
  const sessionsRef = useRef<VotingSession[]>([]);
  const [standardSessions, setStandardSessions] = useState<SessionQuestion[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<"ja" | "nej" | "abstar" | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    setLoading(true);
    setFetchError(null);
    try {
      const savedRaw = await getItem(STORAGE_INTERESTS);
      const saved: string[] = savedRaw ? JSON.parse(savedRaw) : ["budget"];
      const matchedTabs = INTEREST_AREAS.filter((a) => saved.includes(a.key));
      setTabs(matchedTabs);
      setActiveKey((prev) =>
        prev && matchedTabs.some((t) => t.key === prev)
          ? prev
          : (matchedTabs[0]?.key ?? null),
      );

      const [votingData, standardData] = await Promise.all([
        apiClient<VotingSession[]>("/api/mobile/sessions/voting"),
        apiClient<SessionQuestion[]>("/api/mobile/sessions/active"),
      ]);
      sessionsRef.current = votingData;
      setSessions(votingData);
      setStandardSessions(standardData);
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const activeSession = useMemo(() => {
    if (!activeKey) return null;
    const categories = INTEREST_TO_CATEGORIES[activeKey] ?? [];
    return (
      sessions.find(
        (s) => s.isActive && s.categories?.some((c) => categories.includes(c)),
      ) ?? null
    );
  }, [activeKey, sessions]);

  // Older brainstorming-style sessions (multiple proposals, not a single
  // Ja/Nej/Avstå choice) — only consulted when no voting question matches.
  const activeStandardSession = useMemo(() => {
    if (!activeKey || activeSession) return null;
    const categories = INTEREST_TO_CATEGORIES[activeKey] ?? [];
    return (
      standardSessions.find((s) =>
        s.categories?.some((c) => categories.includes(c)),
      ) ?? null
    );
  }, [activeKey, activeSession, standardSessions]);

  function selectTab(key: string) {
    setActiveKey(key);
    setSelected(null);
  }

  async function handleVote() {
    if (!selected || !activeSession || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiClient<{ voteCounts: VoteCounts; userVote: string }>(
        "/api/mobile/quick-vote",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: activeSession.id,
            choice: selected,
          }),
        },
      );
      const updated = sessionsRef.current.map((s) =>
        s.id === activeSession.id
          ? { ...s, voteCounts: res.voteCounts, userVote: res.userVote as any }
          : s,
      );
      sessionsRef.current = updated;
      setSessions(updated);
      await addStars(1);
      setCelebration(true);
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setSubmitting(false);
    }
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

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.gearBtn, { top: insets.top + 10 }]}
          onPress={() => setShowSettings(true)}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons
            name="settings-outline"
            size={22}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mina frågor</Text>
        <Text style={styles.headerSub}>
          Aktuella frågor inom dina valda intresseområden
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabPill, active && styles.tabPillActive]}
              onPress={() => selectTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.tabPillText, active && styles.tabPillTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={
          tabs.length === 0 || (!activeSession && !activeStandardSession)
            ? { flexGrow: 1 }
            : { paddingBottom: 32 }
        }
        showsVerticalScrollIndicator={false}
      >
        {tabs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="options-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>Inga intresseområden valda</Text>
            <Text style={styles.emptyText}>
              Välj vad du bryr dig om under Info → kugghjulet, så visar vi
              frågor som rör just det.
            </Text>
          </View>
        ) : activeSession ? (
          <VotingQuestionCard
            session={activeSession}
            selected={selected}
            onSelect={setSelected}
            onVote={handleVote}
            submitting={submitting}
          />
        ) : activeStandardSession ? (
          <SessionQuestionCard
            session={activeStandardSession}
            onCelebrate={() => setCelebration(true)}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="hourglass-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>Ingen aktivitet just nu</Text>
            <Text style={styles.emptyText}>
              Kom tillbaka snart — nya frågor inom detta område är på väg.
            </Text>
          </View>
        )}
      </ScrollView>

      <CelebrationModal
        visible={celebration}
        title="Bra röstat!"
        subtitle="Du tränar ditt omdöme och bidrar till demokratin. Varje röst räknas!"
        stars={1}
        onDone={() => setCelebration(false)}
      />

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f6fb" },
  header: {
    backgroundColor: BLUE,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
    alignItems: "center",
  },
  gearBtn: {
    position: "absolute",
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  headerSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textAlign: "center",
  },

  tabsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  tabPillActive: { backgroundColor: BLUE, borderColor: BLUE },
  tabPillText: { fontSize: 13, fontWeight: "700", color: "#555" },
  tabPillTextActive: { color: "#fff" },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#555" },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },

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
