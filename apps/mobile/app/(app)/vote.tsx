import { useEffect, useMemo, useRef, useState } from "react";
import CelebrationModal from "../../lib/CelebrationModal";
import { addStars } from "../../lib/stars";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Image,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../lib/api";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface VoteCounts { ja: number; nej: number; abstar: number; }
interface VotingSession {
  id: string;
  question: string;
  imageUrl: string | null;
  isActive: boolean;
  startDate: string;
  createdAt: string;
  voteCounts: VoteCounts;
  userVote: "ja" | "nej" | "abstar" | null;
}

const ALTS: { key: "ja" | "nej" | "abstar"; label: string }[] = [
  { key: "ja", label: "Ja" },
  { key: "nej", label: "Nej" },
  { key: "abstar", label: "Avstår" },
];

export default function VoteScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<VotingSession[]>([]);
  const sessionsRef = useRef<VotingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<"ja" | "nej" | "abstar" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [containerH, setContainerH] = useState(0);
  const initialScrollDone = useRef(false);

  const loopedSessions = useMemo(
    () => (sessions.length > 1 ? [...sessions, ...sessions, ...sessions] : sessions),
    [sessions]
  );

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (sessions.length > 1 && containerH > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      scrollRef.current?.scrollTo({ y: sessions.length * containerH, animated: false });
    }
  }, [sessions.length, containerH]);

  async function load() {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient<VotingSession[]>("/api/mobile/sessions/voting");
      const list = data ?? [];
      sessionsRef.current = list;
      setSessions(list);
      if (list.length > 1) {
        currentIdxRef.current = list.length;
        setCurrentIdx(list.length);
      }
      if (list.length > 0 && list[0].isActive && list[0].userVote) {
        setSelected(list[0].userVote);
      }
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function bgUri(s: VotingSession): string | null {
    if (!s.imageUrl) return null;
    return s.imageUrl.startsWith("http") ? s.imageUrl : `${BASE_URL}${s.imageUrl}`;
  }

  async function handleVote() {
    const active = sessionsRef.current[0]?.isActive ? sessionsRef.current[0] : null;
    if (!selected || !active || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiClient<{ voteCounts: VoteCounts; userVote: string }>(
        "/api/mobile/quick-vote",
        { method: "POST", body: JSON.stringify({ sessionId: active.id, choice: selected }) }
      );
      const updated = sessionsRef.current.map((s) =>
        s.id === active.id ? { ...s, voteCounts: res.voteCounts, userVote: res.userVote as any } : s
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

  function handleMomentumScrollEnd(e: any) {
    const n = sessionsRef.current.length;
    if (n === 0 || containerH === 0) return;
    const rawIdx = Math.round(e.nativeEvent.contentOffset.y / containerH);
    const clampedIdx = n > 1
      ? Math.max(0, Math.min(n * 3 - 1, rawIdx))
      : Math.max(0, Math.min(n - 1, rawIdx));
    if (clampedIdx !== currentIdxRef.current) {
      currentIdxRef.current = clampedIdx;
      setCurrentIdx(clampedIdx);
    }
    // Infinite loop: silently jump to the middle copy when near either end
    if (n > 1) {
      let jumpIdx: number | null = null;
      if (clampedIdx < n) jumpIdx = clampedIdx + n;
      else if (clampedIdx >= 2 * n) jumpIdx = clampedIdx - n;
      if (jumpIdx !== null) {
        currentIdxRef.current = jumpIdx;
        setCurrentIdx(jumpIdx);
        scrollRef.current?.scrollTo({ y: jumpIdx * containerH, animated: false });
      }
    }
  }

  async function handleShare() {
    const n = sessionsRef.current.length;
    const s = sessionsRef.current[n > 0 ? currentIdxRef.current % n : 0];
    if (!s) return;
    try {
      await Share.share({
        message: `Rösta: "${s.question}" — Ladda ner Vallentuna Framåt-appen!`,
        title: "Vallentuna Framåt",
      });
    } catch {}
  }

  if (loading) return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <ActivityIndicator size="large" color={BLUE} />
    </View>
  );

  if (fetchError) return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
      <Text style={styles.errorText}>{fetchError}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={load}>
        <Text style={styles.retryText}>Försök igen</Text>
      </TouchableOpacity>
    </View>
  );

  if (sessions.length === 0) return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <Ionicons name="hourglass-outline" size={56} color="#ccc" />
      <Text style={styles.emptyTitle}>Ingen aktiv omröstning</Text>
      <Text style={styles.emptyText}>Kom tillbaka snart — en ny fråga är på väg.</Text>
      <TouchableOpacity style={styles.suggestBtnEmpty} onPress={() => setShowSuggest(true)} activeOpacity={0.85}>
        <Ionicons name="bulb-outline" size={18} color={BLUE} />
        <Text style={styles.suggestBtnText}>Föreslå en fråga om Vallentuna</Text>
      </TouchableOpacity>
      {showSuggest && <SuggestModal onClose={() => setShowSuggest(false)} />}
    </View>
  );

  const actualDispIdx = sessions.length > 0 ? currentIdx % sessions.length : 0;
  const isDisplayActive = sessions[actualDispIdx]?.isActive ?? false;

  return (
    <View style={styles.screen} onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}>
      <StatusBar barStyle="light-content" />

      {/* Fixed header — sits above the scrollable pages */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ width: 40 }} />
        <Text style={[styles.headerTitle, { flex: 1, textAlign: "center" }]}>
          {isDisplayActive ? "Dagens fråga" : "Tidigare fråga"}
        </Text>
        <TouchableOpacity onPress={handleShare} hitSlop={12}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Full-screen paginated scroll — each page owns its background */}
      <ScrollView
        ref={scrollRef}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={StyleSheet.absoluteFill}
      >
        {loopedSessions.map((s, idx) => {
          const uri = bgUri(s);
          const total = s.voteCounts.ja + s.voteCounts.nej + s.voteCounts.abstar;
          const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
          const isPrimary = s.isActive;
          const showResults = s.userVote != null || !isPrimary;
          const displayDate = new Date(s.startDate || s.createdAt).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
          return (
            <View key={idx} style={{ height: containerH }}>
              {/* Per-page background */}
              <View style={[StyleSheet.absoluteFill, styles.pageBg]} />
              {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
              <View style={[StyleSheet.absoluteFill, styles.bgOverlay]} />

              {/* Card centred in lower half */}
              <View style={{ flex: 1, justifyContent: "flex-end", paddingTop: insets.top + 68, paddingBottom: insets.bottom + 110, paddingHorizontal: 16 }}>
                <View style={styles.card}>
                  <View style={styles.dateLine}>
                    <Ionicons name={isPrimary ? "calendar-outline" : "time-outline"} size={12} color="#666" />
                    <Text style={styles.dateText}>{displayDate}</Text>
                  </View>

                  <Text style={styles.question}>{s.question}</Text>

                  <View style={styles.alternatives}>
                    {ALTS.map(({ key, label }) => {
                      const isSelected = isPrimary ? selected === key : s.userVote === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.alternative, isSelected && styles.alternativeSelected]}
                          onPress={() => isPrimary && !showResults && setSelected(key)}
                          activeOpacity={isPrimary && !showResults ? 0.75 : 1}
                        >
                          <View style={[styles.radio, isSelected && styles.radioSelected]}>
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                          <Text style={[styles.alternativeLabel, isSelected && styles.alternativeLabelSelected]}>
                            {label}
                          </Text>
                          {showResults && (
                            <View style={styles.resultOuter}>
                              <View style={styles.resultBarWrap}>
                                {pct(s.voteCounts[key]) > 0 && (
                                  <View style={[styles.resultFill, { flex: pct(s.voteCounts[key]) / 100 }]} />
                                )}
                              </View>
                              <Text style={styles.resultPct}>{pct(s.voteCounts[key])}%</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {isPrimary && !showResults ? (
                    <TouchableOpacity
                      style={[styles.voteBtn, (!selected || submitting) && styles.voteBtnDisabled]}
                      onPress={handleVote}
                      disabled={!selected || submitting}
                      activeOpacity={0.85}
                    >
                      {submitting ? (
                        <ActivityIndicator color={BLUE} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color={BLUE} />
                          <Text style={styles.voteBtnText}>Rösta</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : isPrimary ? (
                    <View style={styles.votedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                      <Text style={styles.votedText}>Din röst är registrerad · {total} totalt</Text>
                    </View>
                  ) : (
                    <View style={styles.votedBadge}>
                      <Text style={styles.votedText}>{total} {total === 1 ? "röst" : "röster"}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Suggest button pinned to bottom */}
      <View style={[styles.suggestRow, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.suggestBtn} onPress={() => setShowSuggest(true)} activeOpacity={0.85}>
          <Ionicons name="bulb-outline" size={16} color={BLUE} />
          <Text style={styles.suggestBtnText}>Föreslå en fråga om Vallentuna</Text>
        </TouchableOpacity>
      </View>

      {showSuggest && <SuggestModal onClose={() => setShowSuggest(false)} />}

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

function SuggestModal({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!question.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiClient("/api/mobile/suggest-question", {
        method: "POST",
        body: JSON.stringify({ question: question.trim() }),
      });
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Kunde inte skicka — försök igen");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKAV}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Föreslå en fråga</Text>
                  <TouchableOpacity onPress={onClose} hitSlop={12}>
                    <Ionicons name="close" size={22} color="#666" />
                  </TouchableOpacity>
                </View>
                {sent ? (
                  <View style={styles.sentBox}>
                    <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
                    <Text style={styles.sentTitle}>Tack!</Text>
                    <Text style={styles.sentText}>Din fråga har skickats till oss. Vi läser alla förslag.</Text>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                      <Text style={styles.closeBtnText}>Stäng</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>Din fråga</Text>
                    <TextInput
                      style={[styles.textInput, styles.textInputMulti]}
                      placeholder="T.ex. 'Ska Vallentuna satsa mer på kollektivtrafik?'"
                      placeholderTextColor="#aaa"
                      value={question}
                      onChangeText={setQuestion}
                      maxLength={200}
                      multiline
                      numberOfLines={3}
                      autoFocus
                    />
                    <Text style={styles.charCount}>{question.length}/200</Text>
                    {!!error && <Text style={styles.modalError}>{error}</Text>}
                    <TouchableOpacity
                      style={[styles.sendBtn, (!question.trim() || sending) && { opacity: 0.5 }]}
                      onPress={send}
                      disabled={!question.trim() || sending}
                    >
                      {sending ? (
                        <ActivityIndicator color={BLUE} />
                      ) : (
                        <>
                          <Ionicons name="send" size={16} color={BLUE} />
                          <Text style={styles.sendBtnText}>Skicka förslag</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pageBg: { backgroundColor: BLUE },
  bgOverlay: { backgroundColor: "rgba(0,0,20,0.55)" },
  dateLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 11, color: "#666", fontWeight: "600" },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "rgba(0,45,117,0.90)",
    zIndex: 10,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },

  card: {
    backgroundColor: "rgba(255,255,255,0.68)",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  question: { fontSize: 19, fontWeight: "800", color: "#111", lineHeight: 26 },

  alternatives: { gap: 7 },
  alternative: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: "#fafafa",
  },
  alternativeSelected: { borderColor: BLUE, backgroundColor: "#eef2ff" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: BLUE },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE },
  alternativeLabel: { fontSize: 16, fontWeight: "600", color: "#444" },
  alternativeLabelSelected: { color: BLUE },

  resultOuter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  resultBarWrap: { flex: 1, height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" },
  resultFill: { height: "100%" as any, backgroundColor: BLUE, borderRadius: 4 },
  resultPct: { fontSize: 12, color: BLUE, fontWeight: "700", minWidth: 34, textAlign: "right" },

  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  voteBtnDisabled: { opacity: 0.45 },
  voteBtnText: { color: BLUE, fontSize: 16, fontWeight: "800" },
  votedBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  votedText: { fontSize: 13, color: "#444", fontWeight: "600" },

  suggestRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  suggestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  suggestBtnEmpty: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: YELLOW,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
  },
  suggestBtnText: { color: BLUE, fontSize: 15, fontWeight: "800" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalKAV: { justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#111" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#333" },
  textInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#f9fafb",
  },
  textInputMulti: { minHeight: 80, textAlignVertical: "top" },
  charCount: { fontSize: 11, color: "#aaa", textAlign: "right", marginTop: -6 },
  modalError: { color: "#dc2626", fontSize: 13 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  sendBtnText: { color: BLUE, fontSize: 15, fontWeight: "800" },
  sentBox: { alignItems: "center", paddingVertical: 24, gap: 10 },
  sentTitle: { fontSize: 22, fontWeight: "900", color: "#111" },
  sentText: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 20 },
  closeBtn: { backgroundColor: BLUE, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  closeBtnText: { color: "#fff", fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#f4f6fb", paddingHorizontal: 32 },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#555" },
  emptyText: { fontSize: 14, color: "#aaa", textAlign: "center" },
  retryBtn: { backgroundColor: BLUE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "700" },
});
