import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "./api";
import { addStars } from "./stars";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

export interface SessionQuestion {
  id: string;
  place: string;
  phase: string;
  startDate: string;
  sessionType: string;
  noMotivation: boolean;
  categories?: string[];
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
              size={26}
              color={i <= localUserRating ? YELLOW : "#999"}
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
  session: SessionQuestion;
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
                    <ActivityIndicator color={BLUE} />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color={BLUE} />
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

// "Frågor" card for revived brainstorming-style (standard/survey) sessions —
// shown in Mina frågor next to VotingQuestionCard, but with a proposals list
// (star ratings) instead of a single Ja/Nej/Avstå choice, since that's the
// original shape of this content.
export function SessionQuestionCard({
  session,
  onCelebrate,
}: {
  session: SessionQuestion;
  onCelebrate: () => void;
}) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const canSubmit = session.phase === "phase1";

  useEffect(() => {
    load();
  }, [session.id]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiClient<Proposal[]>(
        `/api/mobile/sessions/${session.id}/proposals`,
      );
      setProposals(data);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  function handleProposalUpdated(id: string, patch: Partial<Proposal>) {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  const displayDate = new Date(session.startDate).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.card}>
      <View style={styles.dateLine}>
        <Ionicons name="calendar-outline" size={12} color="#666" />
        <Text style={styles.dateText}>{displayDate}</Text>
      </View>

      <Text style={styles.question}>{session.place}</Text>

      {canSubmit && (
        <TouchableOpacity
          style={styles.enterButton}
          onPress={() => setShowSubmit(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color={BLUE} />
          <Text style={styles.enterButtonText}>Lägg ditt svar</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.proposalsTitle}>Förslag ({proposals.length})</Text>

      {loading ? (
        <ActivityIndicator color={BLUE} />
      ) : proposals.length === 0 ? (
        <Text style={styles.emptyProposalsText}>
          {canSubmit ? "Inga förslag ännu — var den första!" : "Inga förslag"}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              sessionId={session.id}
              onRated={(id, userRating, averageRating, thumbsUpCount) =>
                handleProposalUpdated(id, {
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

      {showSubmit && (
        <SubmitModal
          session={session}
          onClose={() => setShowSubmit(false)}
          onSuccess={(p) => {
            setShowSubmit(false);
            setProposals((prev) => [p, ...prev]);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  dateLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 11, color: "#666", fontWeight: "600" },
  question: { fontSize: 19, fontWeight: "800", color: "#111", lineHeight: 26 },

  enterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: YELLOW,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  enterButtonText: { color: BLUE, fontSize: 13, fontWeight: "800" },

  proposalsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginTop: 4,
  },
  emptyProposalsText: { fontSize: 13, color: "#999" },

  proposalCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  proposalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    lineHeight: 20,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  proposalVotes: { fontSize: 11, color: "#666", marginLeft: 2 },
  proposalBody: { fontSize: 12, color: "#333", lineHeight: 18 },
  proposalBodyLabel: { fontWeight: "700", color: "#111" },
  expandHint: { fontSize: 11, color: BLUE, fontWeight: "600" },

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
  textInputMulti: { minHeight: 72, textAlignVertical: "top" },
  modalError: { color: "#dc2626", fontSize: 13 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 6,
  },
  submitBtnText: { color: BLUE, fontSize: 15, fontWeight: "800" },
});
