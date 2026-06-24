import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import CelebrationModal from "../lib/CelebrationModal";
import { addStars } from "../lib/stars";

interface ActiveSession {
  id: string;
  place: string;
  phase: string;
  startDate: string;
  sessionType: string;
  activeUsersCount: number;
  showUserCount: boolean;
  noMotivation: boolean;
  imageUrl: string | null;
}

interface Proposal {
  id: string;
  title: string;
  problem: string;
  solution: string;
  averageRating: number;
  thumbsUpCount: number;
  authorName: string;
  userRating: number;
}

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

function resolveImage(session: ActiveSession): string {
  if (!session.imageUrl) return PLACEHOLDER_IMAGE;
  if (session.imageUrl.startsWith("http")) return session.imageUrl;
  return `${BASE_URL}${session.imageUrl}`;
}

function ProposalCard({
  proposal,
  sessionId,
  onRated,
  onCelebrate,
}: {
  proposal: Proposal;
  sessionId: string;
  onRated: (
    id: string,
    userRating: number,
    averageRating: number,
    thumbsUpCount: number,
  ) => void;
  onCelebrate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localUserRating, setLocalUserRating] = useState(proposal.userRating);
  const [localAvg, setLocalAvg] = useState(proposal.averageRating);
  const [localCount, setLocalCount] = useState(proposal.thumbsUpCount);
  const [rating, setRating] = useState(false);
  const hasDetails = !!proposal.problem || !!proposal.solution;

  async function handleRate(stars: number) {
    if (rating) return;
    setRating(true);
    const prev = localUserRating;
    setLocalUserRating(stars);
    try {
      const result = await apiClient<{
        averageRating: number;
        thumbsUpCount: number;
        userRating: number;
      }>("/api/mobile/proposals/rate", {
        method: "POST",
        body: JSON.stringify({
          proposalId: proposal.id,
          rating: stars,
          sessionId,
        }),
      });
      setLocalAvg(result.averageRating);
      setLocalCount(result.thumbsUpCount);
      onRated(proposal.id, stars, result.averageRating, result.thumbsUpCount);
      await addStars(3);
      onCelebrate();
    } catch {
      setLocalUserRating(prev);
    } finally {
      setRating(false);
    }
  }

  return (
    <View style={styles.proposalCard}>
      <TouchableOpacity
        onPress={() => hasDetails && setExpanded((e) => !e)}
        activeOpacity={hasDetails ? 0.75 : 1}
      >
        <Text style={styles.proposalTitle}>{proposal.title}</Text>
      </TouchableOpacity>

      {/* Interactive stars */}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handleRate(i)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={i <= localUserRating ? "star" : "star-outline"}
              size={30}
              color={i <= localUserRating ? "#f5a623" : "#666"}
            />
          </TouchableOpacity>
        ))}
        <Text style={styles.proposalVotes}>
          {localCount > 0
            ? `${localCount} röster · snitt ${localAvg.toFixed(1)}`
            : "Ingen röstat än"}
        </Text>
      </View>

      {expanded && !!proposal.problem && (
        <Text style={styles.proposalBody}>
          <Text style={styles.proposalBodyLabel}>Problem: </Text>
          {proposal.problem}
        </Text>
      )}
      {expanded && !!proposal.solution && (
        <Text style={styles.proposalBody}>
          <Text style={styles.proposalBodyLabel}>Lösning: </Text>
          {proposal.solution}
        </Text>
      )}
      {hasDetails && (
        <Text style={styles.expandHint}>{expanded ? "Dölj" : "Visa mer"}</Text>
      )}
    </View>
  );
}

function SubmitModal({
  session,
  onClose,
  onSuccess,
}: {
  session: ActiveSession;
  onClose: () => void;
  onSuccess: (proposal: Proposal) => void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("Ange ett namn på ditt förslag");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const proposal = await apiClient<Proposal>(
        `/api/mobile/sessions/${session.id}/proposals`,
        { method: "POST", body: JSON.stringify({ title, problem, solution }) },
      );
      onSuccess(proposal);
    } catch (e: any) {
      setError(e.message || "Något gick fel");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKAV}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalSheet,
                  { paddingBottom: insets.bottom + 16 },
                ]}
              >
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Lägg ditt svar</Text>
                  <TouchableOpacity onPress={onClose} hitSlop={12}>
                    <Ionicons name="close" size={22} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalQuestion} numberOfLines={2}>
                  {session.place}
                </Text>

                <Text style={styles.inputLabel}>Ditt förslag *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Skriv ditt förslag här..."
                  placeholderTextColor="#aaa"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={200}
                  returnKeyType={session.noMotivation ? "done" : "next"}
                  autoFocus
                />

                {!session.noMotivation && (
                  <>
                    <Text style={styles.inputLabel}>Problem (valfritt)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textInputMulti]}
                      placeholder="Beskriv problemet..."
                      placeholderTextColor="#aaa"
                      value={problem}
                      onChangeText={setProblem}
                      maxLength={500}
                      multiline
                      numberOfLines={3}
                    />

                    <Text style={styles.inputLabel}>Lösning (valfritt)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textInputMulti]}
                      placeholder="Beskriv din lösning..."
                      placeholderTextColor="#aaa"
                      value={solution}
                      onChangeText={setSolution}
                      maxLength={500}
                      multiline
                      numberOfLines={3}
                    />
                  </>
                )}

                {!!error && <Text style={styles.modalError}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={submit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#002d75" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#002d75" />
                      <Text style={styles.submitBtnText}>
                        Skicka in förslag
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function SessionPage({
  session,
  proposals,
  onSubmitSuccess,
  onProposalUpdated,
  onCelebrate,
}: {
  session: ActiveSession;
  proposals: Proposal[];
  onSubmitSuccess: (p: Proposal) => void;
  onProposalUpdated: (id: string, patch: Partial<Proposal>) => void;
  onCelebrate: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [showSubmit, setShowSubmit] = useState(false);
  const [scrolledOnce, setScrolledOnce] = useState(false);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const canSubmit = session.phase === "phase1";
  const hasMoreBelow = contentH > viewportH + 4;

  return (
    <View style={styles.page}>
      <Image
        source={{ uri: resolveImage(session) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={{ paddingTop: insets.top + 64 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={(e) => {
          if (!scrolledOnce && e.nativeEvent.contentOffset.y > 4) {
            setScrolledOnce(true);
          }
        }}
        onContentSizeChange={(_, h) => setContentH(h)}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
      >
        {/* Title block — compact, sits near top of page */}
        <View style={styles.heroContent}>
          <Text style={styles.sessionTitle}>{session.place}</Text>

          <Text style={styles.sessionDate}>
            {new Date(session.startDate).toLocaleDateString("sv-SE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>

          {session.showUserCount && (
            <View style={styles.participantRow}>
              <Ionicons
                name="people-outline"
                size={15}
                color="rgba(255,255,255,0.8)"
              />
              <Text style={styles.participantText}>
                {session.activeUsersCount} deltagare
              </Text>
            </View>
          )}

          {canSubmit && (
            <TouchableOpacity
              style={styles.enterButton}
              onPress={() => setShowSubmit(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#002d75" />
              <Text style={styles.enterButtonText}>Lägg ditt svar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Proposals — inline directly after title */}
        <View style={styles.proposalsOverlay}>
          <Text style={styles.proposalsSectionTitle}>
            Förslag ({proposals.length})
          </Text>
          {proposals.length === 0 ? (
            <View style={styles.emptyProposals}>
              <Ionicons
                name="document-outline"
                size={40}
                color="rgba(255,255,255,0.4)"
              />
              <Text style={styles.emptyProposalsText}>
                {canSubmit
                  ? "Inga förslag ännu — var den första!"
                  : "Inga förslag"}
              </Text>
            </View>
          ) : (
            <View style={styles.proposalCardList}>
              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  sessionId={session.id}
                  onRated={(id, userRating, averageRating, thumbsUpCount) =>
                    onProposalUpdated(id, {
                      userRating,
                      averageRating,
                      thumbsUpCount,
                    })
                  }
                  onCelebrate={onCelebrate}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Scroll affordance: subtle chevron at bottom of page, hides once user scrolls */}
      {hasMoreBelow && !scrolledOnce && (
        <View pointerEvents="none" style={styles.scrollAffordance}>
          <Ionicons
            name="chevron-down"
            size={22}
            color="rgba(255,255,255,0.7)"
          />
        </View>
      )}

      {showSubmit && (
        <SubmitModal
          session={session}
          onClose={() => setShowSubmit(false)}
          onSuccess={(p) => {
            setShowSubmit(false);
            onSubmitSuccess(p);
          }}
        />
      )}
    </View>
  );
}

export default function SessionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [proposalsMap, setProposalsMap] = useState<Record<string, Proposal[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const isJumpingRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/(auth)/login");
      return;
    }
    if (user) load();
  }, [user, isLoading]);

  useEffect(() => {
    if (sessions.length === 0) return;
    sessions.forEach((s) => Image.prefetch(resolveImage(s)));
  }, [sessions]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiClient<ActiveSession[]>(
        "/api/mobile/sessions/active",
      );
      setSessions(data);
      const entries = await Promise.all(
        data.map(async (s) => {
          try {
            const proposals = await apiClient<Proposal[]>(
              `/api/mobile/sessions/${s.id}/proposals`,
            );
            return [s.id, proposals] as const;
          } catch {
            return [s.id, []] as const;
          }
        }),
      );
      setProposalsMap(Object.fromEntries(entries));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleNewProposal(sessionId: string, proposal: Proposal) {
    setProposalsMap((prev) => ({
      ...prev,
      [sessionId]: [proposal, ...(prev[sessionId] || [])],
    }));
  }

  function handleProposalUpdated(
    sessionId: string,
    proposalId: string,
    patch: Partial<Proposal>,
  ) {
    setProposalsMap((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).map((p) =>
        p.id === proposalId ? { ...p, ...patch } : p,
      ),
    }));
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#002d75" />
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
        <Ionicons name="people-outline" size={56} color="#ccc" />
        <Text style={styles.emptyTitle}>Inga aktiva sessioner</Text>
        <Text style={styles.emptyText}>Kom tillbaka senare</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.screenContainer}
      onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
    >
      {pageHeight > 0 &&
        (() => {
          const n = sessions.length;
          const looped =
            n > 1 ? [...sessions, ...sessions, ...sessions] : sessions;
          const initialPage = n > 1 ? n : 0; // start at first item of middle copy
          return (
            <PagerView
              ref={pagerRef}
              style={{ flex: 1 }}
              orientation="vertical"
              initialPage={initialPage}
              offscreenPageLimit={1}
              onPageSelected={(e) => {
                if (n <= 1) return;
                if (isJumpingRef.current) {
                  isJumpingRef.current = false;
                  return;
                }
                const pos = e.nativeEvent.position;
                // Jump silently back to the matching slot in the middle copy
                // whenever the user lands in the first or last copy.
                if (pos < n) {
                  isJumpingRef.current = true;
                  pagerRef.current?.setPageWithoutAnimation(pos + n);
                } else if (pos >= n * 2) {
                  isJumpingRef.current = true;
                  pagerRef.current?.setPageWithoutAnimation(pos - n);
                }
              }}
            >
              {looped.map((session, index) => (
                <View key={`${session.id}-${index}`} style={{ flex: 1 }}>
                  <SessionPage
                    session={session}
                    proposals={proposalsMap[session.id] ?? []}
                    onSubmitSuccess={(p) => handleNewProposal(session.id, p)}
                    onProposalUpdated={(id, patch) =>
                      handleProposalUpdated(session.id, id, patch)
                    }
                    onCelebrate={() => setCelebration(true)}
                  />
                </View>
              ))}
            </PagerView>
          );
        })()}

      <CelebrationModal
        visible={celebration}
        title="Bra jobbat!"
        subtitle="Du har svarat på ett förslag och hjälper till att forma besluten i Vallentuna."
        stars={3}
        onDone={() => setCelebration(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  page: { flex: 1 },
  pageScroll: { flex: 1, backgroundColor: "transparent" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 10,
  },
  phaseBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  phaseText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sessionTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  sessionDate: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  participantText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  enterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#f5a623",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    marginTop: 4,
  },
  enterButtonText: { color: "#002d75", fontSize: 14, fontWeight: "800" },
  scrollAffordance: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
  },

  // Proposals overlay (sits over the background image)
  proposalsOverlay: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
  },
  proposalsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 14,
  },
  proposalCardList: { gap: 10 },
  proposalCard: {
    backgroundColor: "rgba(210,210,210,0.72)",
    borderRadius: 14,
    padding: 14,
    gap: 7,
  },
  proposalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    lineHeight: 21,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
    flexWrap: "wrap",
  },
  proposalVotes: { fontSize: 12, color: "#444", marginLeft: 4 },
  proposalBody: { fontSize: 13, color: "#222", lineHeight: 19 },
  proposalBodyLabel: { fontWeight: "700", color: "#111" },
  expandHint: { fontSize: 12, color: "#002d75", fontWeight: "600" },
  emptyProposals: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  emptyProposalsText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },

  // Submit modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalKAV: { justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#111" },
  modalQuestion: { fontSize: 13, color: "#666", marginBottom: 4 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 4 },
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
  textInputMulti: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  modalError: { color: "#dc2626", fontSize: 13 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5a623",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 6,
  },
  submitBtnText: { color: "#002d75", fontSize: 15, fontWeight: "800" },

  // Shared
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f4f6fb",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#555" },
  emptyText: { fontSize: 14, color: "#aaa" },
  retryBtn: {
    backgroundColor: "#002d75",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
});
