import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../lib/api";

interface TopProposal {
  title: string;
  yesVotes: number;
  noVotes: number;
  authorName: string;
}

interface ArchivedSession {
  id: string;
  place: string;
  startDate: string;
  endDate: string | null;
  status: string;
  topProposals: TopProposal[];
}

export default function ArchiveScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions]   = useState<ArchivedSession[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<ArchivedSession[]>("/api/mobile/sessions/archived");
      setSessions(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Försök igen</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (sessions.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="archive-outline" size={56} color="#ccc" />
        <Text style={styles.emptyTitle}>Inga avslutade sessioner</Text>
        <Text style={styles.emptyText}>Avslutade sessioner med resultat visas här.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Arkiv</Text>

      {sessions.map((session) => {
        const isOpen = expanded[session.id] ?? true;
        const totalVotes = session.topProposals.reduce(
          (sum, p) => sum + p.yesVotes + p.noVotes, 0
        );
        return (
          <View key={session.id} style={styles.sessionCard}>
            <TouchableOpacity
              style={styles.sessionHeader}
              onPress={() => toggleExpand(session.id)}
              activeOpacity={0.8}
            >
              <View style={styles.headerLeft}>
                <Text style={styles.sessionPlace}>{session.place}</Text>
                <Text style={styles.sessionDate}>
                  {new Date(session.startDate).toLocaleDateString("sv-SE", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                  {session.endDate
                    ? ` – ${new Date(session.endDate).toLocaleDateString("sv-SE", {
                        day: "numeric", month: "short",
                      })}`
                    : ""}
                </Text>
                {totalVotes > 0 && (
                  <Text style={styles.voteCount}>{totalVotes} röster totalt</Text>
                )}
              </View>
              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color="rgba(255,255,255,0.7)"
              />
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.proposalList}>
                {session.topProposals.length === 0 ? (
                  <Text style={styles.noResults}>Inga topförslag registrerade.</Text>
                ) : (
                  session.topProposals.map((tp, i) => {
                    const total = tp.yesVotes + tp.noVotes;
                    const yesPct = total > 0 ? Math.round((tp.yesVotes / total) * 100) : 0;
                    return (
                      <View key={i} style={styles.proposalItem}>
                        <Text style={styles.proposalTitle}>{tp.title}</Text>
                        <View style={styles.voteBar}>
                          <View style={[styles.yesBar, { flex: tp.yesVotes || 0.001 }]} />
                          <View style={[styles.noBar,  { flex: tp.noVotes  || 0.001 }]} />
                        </View>
                        <View style={styles.voteLegend}>
                          <Text style={styles.yesLabel}>
                            <Ionicons name="checkmark" size={11} /> Ja: {tp.yesVotes} ({yesPct}%)
                          </Text>
                          <Text style={styles.noLabel}>
                            <Ionicons name="close" size={11} /> Nej: {tp.noVotes} ({100 - yesPct}%)
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const BLUE   = "#002d75";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f4f6fb" },
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 12, backgroundColor: "#f4f6fb", paddingHorizontal: 32,
  },

  pageTitle: { fontSize: 24, fontWeight: "900", color: BLUE, marginBottom: 16, letterSpacing: 0.5, paddingLeft: 64 },

  sessionCard: {
    backgroundColor: "#fff", borderRadius: 16, marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  sessionHeader: {
    backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerLeft:   { flex: 1, gap: 2 },
  sessionPlace: { color: "#fff", fontSize: 17, fontWeight: "800" },
  sessionDate:  { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  voteCount:    { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },

  proposalList: { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  proposalItem: { gap: 6 },
  proposalTitle: { fontSize: 14, fontWeight: "600", color: "#222" },

  voteBar: {
    height: 8, borderRadius: 4, flexDirection: "row", overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  yesBar: { backgroundColor: "#16a34a" },
  noBar:  { backgroundColor: "#dc2626" },
  voteLegend: { flexDirection: "row", gap: 16 },
  yesLabel:   { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  noLabel:    { fontSize: 12, color: "#dc2626", fontWeight: "600" },

  noResults:  { color: "#999", fontSize: 13, paddingVertical: 4 },
  errorText:  { color: "#dc2626", fontSize: 14, textAlign: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#555" },
  emptyText:  { fontSize: 14, color: "#aaa", textAlign: "center" },
  retryBtn:   { backgroundColor: BLUE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText:  { color: "#fff", fontWeight: "700" },
});
