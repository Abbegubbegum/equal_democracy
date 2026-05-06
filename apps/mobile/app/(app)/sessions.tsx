import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../lib/api";
import CelebrationModal from "../../lib/CelebrationModal";
import { addStars } from "../../lib/stars";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const PHASE_LABEL: Record<string, string> = {
  phase1: "Diskussion & prioritering",
  phase2: "Omröstning pågår",
  closed: "Avslutad",
};

const PHASE_COLOR: Record<string, string> = {
  phase1: "#16a34a",
  phase2: "#2563eb",
  closed: "#6b7280",
};

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

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80";
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
  onRated: (id: string, userRating: number, averageRating: number, thumbsUpCount: number) => void;
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
      const result = await apiClient<{ averageRating: number; thumbsUpCount: number; userRating: number }>(
        "/api/mobile/proposals/rate",
        { method: "POST", body: JSON.stringify({ proposalId: proposal.id, rating: stars, sessionId }) }
      );
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
          {localCount > 0 ? `${localCount} röster · snitt ${localAvg.toFixed(1)}` : "Ingen röstat än"}
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
        { method: "POST", body: JSON.stringify({ title, problem, solution }) }
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
              <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
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
                      <Text style={styles.submitBtnText}>Skicka in förslag</Text>
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

function SessionBlock({
  session,
  proposals,
  heroHeight,
  onSubmitSuccess,
  onProposalUpdated,
  onLayout,
  onCelebrate,
}: {
  session: ActiveSession;
  proposals: Proposal[];
  heroHeight: number;
  onSubmitSuccess: (p: Proposal) => void;
  onProposalUpdated: (id: string, patch: Partial<Proposal>) => void;
  onLayout: (y: number) => void;
  onCelebrate: () => void;
}) {
  const [showSubmit, setShowSubmit] = useState(false);
  const phase = session.phase;
  const canSubmit = phase === "phase1";

  return (
    <View onLayout={(e) => onLayout(e.nativeEvent.layout.y)}>

      {/* Hero area */}
      <View style={[styles.heroContent, { height: heroHeight }]}>
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
            <Ionicons name="people-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={styles.participantText}>{session.activeUsersCount} deltagare</Text>
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

        <View style={styles.scrollHint}>
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.5)" />
          <Text style={styles.scrollHintText}>Scrolla för att se förslag</Text>
        </View>
      </View>

      {/* Proposals overlay — floats over the image */}
      <View style={styles.proposalsOverlay}>
        <Text style={styles.proposalsSectionTitle}>
          Förslag ({proposals.length})
        </Text>
        {proposals.length === 0 ? (
          <View style={styles.emptyProposals}>
            <Ionicons name="document-outline" size={40} color="rgba(255,255,255,0.4)" />
            <Text style={styles.emptyProposalsText}>
              {canSubmit ? "Inga förslag ännu — var den första!" : "Inga förslag"}
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
                  onProposalUpdated(id, { userRating, averageRating, thumbsUpCount })
                }
                onCelebrate={onCelebrate}
              />
            ))}
          </View>
        )}
      </View>

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
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [proposalsMap, setProposalsMap] = useState<Record<string, Proposal[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState(false);
  // Double-buffer background: two always-mounted layers swap roles on each transition.
  // Neither layer ever unmounts, so there is no source-reload flash.
  const [uriA, setUriA] = useState(PLACEHOLDER_IMAGE);
  const [uriB, setUriB] = useState(PLACEHOLDER_IMAGE);
  // Refs track what URI each layer currently holds so we can detect no-op setUriA/B calls.
  // When the standby layer already has the right URI, onLoad won't re-fire, so we
  // trigger the animation directly instead of waiting for a callback that never comes.
  const uriARef         = useRef(PLACEHOLDER_IMAGE);
  const uriBRef         = useRef(PLACEHOLDER_IMAGE);
  const translateA      = useRef(new Animated.Value(0)).current;
  const translateB      = useRef(new Animated.Value(SCREEN_H)).current;
  const currentLayer    = useRef<"a" | "b">("a"); // which layer is currently at translateY=0
  const displayBgIdxRef = useRef(0);
  const isAnimatingBg   = useRef(false);
  const prevScrollY     = useRef(0);
  const pendingBgRef    = useRef<{ newIdx: number; scrolledDown: boolean; standby: "a" | "b" } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const allOffsets = useRef<number[]>([]);
  const initialScrollDone = useRef(false);
  const isJumping = useRef(false);

  const heroHeight = SCREEN_H - insets.bottom - (StatusBar.currentHeight ?? 0);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (sessions.length === 0) return;
    sessions.forEach((s) => Image.prefetch(resolveImage(s)));
    // Initialise layer A as the first background; layer B stays parked off-screen
    const initialUri = resolveImage(sessions[0]);
    uriARef.current = initialUri;
    setUriA(initialUri);
    currentLayer.current = "a";
    displayBgIdxRef.current = 0;
    translateA.setValue(0);
    translateB.setValue(SCREEN_H);
  }, [sessions]);

  async function load() {
    allOffsets.current = [];
    initialScrollDone.current = false;
    setError(null);
    setLoading(true);
    try {
      const data = await apiClient<ActiveSession[]>("/api/mobile/sessions/active");
      setSessions(data);
      // Fetch proposals for all sessions in parallel
      const entries = await Promise.all(
        data.map(async (s) => {
          try {
            const proposals = await apiClient<Proposal[]>(
              `/api/mobile/sessions/${s.id}/proposals`
            );
            return [s.id, proposals] as const;
          } catch {
            return [s.id, []] as const;
          }
        })
      );
      setProposalsMap(Object.fromEntries(entries));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleBlockLayout(index: number, y: number) {
    allOffsets.current[index] = y;
    // Once the first block of the middle copy is measured, scroll there silently
    if (!initialScrollDone.current && index === sessions.length && y > 0) {
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      });
    }
  }

  function triggerBgTransition(newIdx: number, scrolledDown: boolean) {
    if (isAnimatingBg.current) return;
    if (newIdx === displayBgIdxRef.current) return;
    isAnimatingBg.current = true;

    // The standby layer is whichever is NOT currently showing
    const standby: "a" | "b" = currentLayer.current === "a" ? "b" : "a";
    pendingBgRef.current = { newIdx, scrolledDown, standby };

    // Park standby off-screen in the scroll direction, then update its URI.
    // onLoad fires once the image is decoded; only then do we slide it in.
    const slideFrom = scrolledDown ? SCREEN_H : -SCREEN_H;
    const newUri = resolveImage(sessions[newIdx]);
    const standbyCurrentUri = standby === "b" ? uriBRef.current : uriARef.current;

    if (standby === "b") {
      translateB.setValue(slideFrom);
      uriBRef.current = newUri;
      setUriB(newUri);
    } else {
      translateA.setValue(slideFrom);
      uriARef.current = newUri;
      setUriA(newUri);
    }

    // If the standby layer already holds this URI, React won't re-render → onLoad
    // won't fire. The image is already decoded (was shown before), so we can
    // start the animation immediately.
    if (standbyCurrentUri === newUri) {
      onLayerLoad(standby);
    }
  }

  function onLayerLoad(layer: "a" | "b") {
    const pending = pendingBgRef.current;
    // Ignore stale onLoad callbacks (e.g. initial load or wrong layer)
    if (!pending || layer !== pending.standby) return;

    const incomingTranslate = layer === "a" ? translateA : translateB;
    const outgoingTranslate = layer === "a" ? translateB : translateA;

    Animated.timing(incomingTranslate, { toValue: 0, duration: 300, useNativeDriver: true })
      .start(({ finished }) => {
        if (finished) {
          // Outgoing is now completely hidden behind incoming (both at translateY=0).
          // Reset outgoing off-screen — no visible change because it's covered.
          outgoingTranslate.setValue(pending.scrolledDown ? -SCREEN_H : SCREEN_H);
          currentLayer.current = layer;
          displayBgIdxRef.current = pending.newIdx;
        }
        isAnimatingBg.current = false;
        pendingBgRef.current = null;
      });
  }

  function handleScroll(e: any) {
    const y = e.nativeEvent.contentOffset.y;
    const scrolledDown = y > prevScrollY.current;
    prevScrollY.current = y;
    const n = sessions.length;

    // Determine which session block is in view and trigger bg transition
    let bgi = 0;
    for (let i = 0; i < allOffsets.current.length; i++) {
      if (allOffsets.current[i] != null && y >= allOffsets.current[i] - heroHeight * 0.4) bgi = i;
    }
    const newModulo = n > 0 ? bgi % n : 0;
    if (!isJumping.current) triggerBgTransition(newModulo, scrolledDown);

    // Infinite loop: jump from outer copies back to middle copy
    if (isJumping.current || n <= 1) return;
    const midStart = allOffsets.current[n];
    const thirdStart = allOffsets.current[n * 2];
    if (midStart == null || thirdStart == null) return;
    const totalOneCopy = midStart;

    if (y < midStart) {
      isJumping.current = true;
      scrollRef.current?.scrollTo({ y: y + totalOneCopy, animated: false });
      setTimeout(() => { isJumping.current = false; }, 50);
    } else if (y >= thirdStart) {
      isJumping.current = true;
      scrollRef.current?.scrollTo({ y: y - totalOneCopy, animated: false });
      setTimeout(() => { isJumping.current = false; }, 50);
    }
  }

  function handleNewProposal(sessionId: string, proposal: Proposal) {
    setProposalsMap((prev) => ({
      ...prev,
      [sessionId]: [proposal, ...(prev[sessionId] || [])],
    }));
  }

  function handleProposalUpdated(sessionId: string, proposalId: string, patch: Partial<Proposal>) {
    setProposalsMap((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).map((p) =>
        p.id === proposalId ? { ...p, ...patch } : p
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

  const loopedSessions = sessions.length > 1
    ? [...sessions, ...sessions, ...sessions]
    : sessions;

  return (
    <View style={styles.screenContainer}>
      {/* Two always-mounted layers — no unmounting means no decode-flash */}
      <Animated.Image
        source={{ uri: uriA }}
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: translateA }] }]}
        resizeMode="cover"
        onLoad={() => onLayerLoad("a")}
        onError={() => onLayerLoad("a")}
      />
      <Animated.Image
        source={{ uri: uriB }}
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: translateB }] }]}
        resizeMode="cover"
        onLoad={() => onLayerLoad("b")}
        onError={() => onLayerLoad("b")}
      />
      <View style={styles.overlay} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {loopedSessions.map((session, index) => (
          <SessionBlock
            key={`${session.id}-${index}`}
            session={session}
            proposals={proposalsMap[session.id] ?? []}
            heroHeight={heroHeight}
            onSubmitSuccess={(p) => handleNewProposal(session.id, p)}
            onProposalUpdated={(id, patch) => handleProposalUpdated(session.id, id, patch)}
            onLayout={(y) => handleBlockLayout(index, y)}
            onCelebrate={() => setCelebration(true)}
          />
        ))}
      </ScrollView>

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
  scroll: { flex: 1, backgroundColor: "transparent" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  heroContent: {
    justifyContent: "flex-end",
    padding: 24,
    paddingBottom: 32,
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
  sessionTitle: { color: "#fff", fontSize: 26, fontWeight: "900", lineHeight: 32 },
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
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  scrollHintText: { color: "rgba(255,255,255,0.45)", fontSize: 12 },

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
  proposalTitle: { fontSize: 15, fontWeight: "700", color: "#111", lineHeight: 21 },
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
  emptyProposalsText: { fontSize: 14, color: "rgba(255,255,255,0.75)", textAlign: "center" },

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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#f4f6fb" },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#555" },
  emptyText: { fontSize: 14, color: "#aaa" },
  retryBtn: { backgroundColor: "#002d75", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "700" },
});
