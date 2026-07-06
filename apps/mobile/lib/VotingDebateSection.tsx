import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "./api";
import { addStars } from "./stars";

const BLUE = "#002d75";
const YELLOW = "#f5a623";
const GREEN = "#16a34a";
const RED = "#dc2626";
const GRAY = "#6b7280";

interface VotingComment {
  _id: string;
  text: string;
  type: "for" | "against" | "neutral";
  averageRating: number;
  createdAt: string;
  isOwn: boolean;
  userRating: number;
}

const TYPES: {
  key: "neutral" | "for" | "against";
  label: string;
  color: string;
}[] = [
  { key: "neutral", label: "Neutral", color: GRAY },
  { key: "for", label: "För", color: GREEN },
  { key: "against", label: "Emot", color: RED },
];

function typeColor(t: string) {
  return TYPES.find((x) => x.key === t)?.color ?? GRAY;
}

function typeLabel(t: string) {
  return TYPES.find((x) => x.key === t)?.label ?? "Neutral";
}

// Mirrors the server sort (averageRating desc, then newest first) so
// optimistic inserts/rating updates don't visibly disagree with a refetch.
function sortComments(list: VotingComment[]): VotingComment[] {
  return [...list].sort((a, b) => {
    if (b.averageRating !== a.averageRating)
      return b.averageRating - a.averageRating;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// Self-contained inline för/emot debate section for a Question —
// mirrors the web for/against debate on standard sessions
// (apps/web/pages/session/[id].tsx) but keyed by questionId instead of
// proposalId, since Questions have no Proposal.
export default function VotingDebateSection({
  questionId,
  canPost,
}: {
  questionId: string;
  canPost: boolean;
}) {
  const [comments, setComments] = useState<VotingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [type, setType] = useState<"neutral" | "for" | "against">("neutral");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modDialog, setModDialog] = useState<{
    severity: "warn" | "flag";
    message: string;
  } | null>(null);

  useEffect(() => {
    load();
  }, [questionId]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiClient<VotingComment[]>(
        `/api/mobile/questions/comments?questionId=${questionId}`,
      );
      setComments(sortComments(data));
    } catch {
      // Non-fatal — leave list empty, the composer still works.
    } finally {
      setLoading(false);
    }
  }

  async function doPost() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiClient<VotingComment>(
        "/api/mobile/questions/comments",
        {
          method: "POST",
          body: JSON.stringify({ questionId, text: text.trim(), type }),
        },
      );
      setComments((prev) => sortComments([...prev, created]));
      setText("");
      setType("neutral");
      await addStars(1);
    } catch (e: any) {
      setError(e.message || "Något gick fel");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const mod = await apiClient<{
        status: "ok" | "warn" | "flag";
        message: string;
      }>("/api/mobile/moderate", {
        method: "POST",
        body: JSON.stringify({ text: trimmed }),
      });
      setSubmitting(false);
      if (mod.status === "ok") {
        await doPost();
      } else {
        setModDialog({ severity: mod.status, message: mod.message });
      }
    } catch {
      // Moderation check failed — fail open, same as the web flow.
      setSubmitting(false);
      await doPost();
    }
  }

  async function handleRate(commentId: string, rating: number) {
    if (!canPost) return;
    setComments((prev) =>
      sortComments(
        prev.map((c) =>
          c._id === commentId ? { ...c, userRating: rating } : c,
        ),
      ),
    );
    try {
      const res = await apiClient<{
        averageRating: number;
        userRating: number;
      }>("/api/mobile/questions/comments/rate", {
        method: "POST",
        body: JSON.stringify({ commentId, rating }),
      });
      setComments((prev) =>
        sortComments(
          prev.map((c) =>
            c._id === commentId
              ? {
                  ...c,
                  averageRating: res.averageRating,
                  userRating: res.userRating,
                }
              : c,
          ),
        ),
      );
    } catch {
      // Leave the optimistic rating in place — non-fatal.
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Debatt</Text>

      {canPost ? (
        <View style={styles.composer}>
          {modDialog && (
            <View
              style={[
                styles.modCard,
                {
                  borderColor: modDialog.severity === "flag" ? RED : YELLOW,
                  backgroundColor:
                    modDialog.severity === "flag" ? "#fef2f2" : "#fffbeb",
                },
              ]}
            >
              <Text
                style={[
                  styles.modTitle,
                  {
                    color:
                      modDialog.severity === "flag" ? "#991b1b" : "#92400e",
                  },
                ]}
              >
                {modDialog.severity === "flag"
                  ? "⚠️ MAJ undrar om du verkligen vill publicera detta?"
                  : "💡 MAJ undrar om du verkligen vill publicera detta?"}
              </Text>
              {!!modDialog.message && (
                <Text
                  style={[
                    styles.modMessage,
                    {
                      color:
                        modDialog.severity === "flag" ? "#b91c1c" : "#a16207",
                    },
                  ]}
                >
                  {modDialog.message}
                </Text>
              )}
              {modDialog.severity === "flag" && (
                <Text style={styles.modLegal}>
                  Du är ansvarig för dina handlingar, och vi vet vem du är även
                  om vi inte publicerar det.
                </Text>
              )}
              <View style={styles.modRow}>
                <TouchableOpacity
                  style={styles.modCancel}
                  onPress={() => setModDialog(null)}
                >
                  <Text style={styles.modCancelText}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modConfirm,
                    {
                      backgroundColor:
                        modDialog.severity === "flag" ? RED : YELLOW,
                    },
                  ]}
                  onPress={async () => {
                    setModDialog(null);
                    await doPost();
                  }}
                >
                  <Text style={styles.modConfirmText}>Publicera ändå</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typePill,
                  type === t.key && {
                    backgroundColor: t.color,
                    borderColor: t.color,
                  },
                ]}
                onPress={() => setType(t.key)}
              >
                <Text
                  style={[
                    styles.typePillText,
                    type === t.key && { color: "#fff" },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Argumentera här"
              placeholderTextColor="#aaa"
              value={text}
              onChangeText={setText}
              maxLength={1000}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!text.trim() || submitting) && { opacity: 0.5 },
              ]}
              onPress={handleSend}
              disabled={!text.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={BLUE} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={BLUE} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.closedNotice}>
          Debatten är stängd för den här frågan.
        </Text>
      )}

      {loading ? (
        <ActivityIndicator color={BLUE} style={{ marginVertical: 24 }} />
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>
          Inga kommentarer än — bli först att debattera.
        </Text>
      ) : (
        <View style={styles.list}>
          {comments.map((c) => (
            <View key={c._id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View
                  style={[
                    styles.typeDot,
                    { backgroundColor: typeColor(c.type) },
                  ]}
                />
                <Text style={[styles.typeLabel, { color: typeColor(c.type) }]}>
                  {typeLabel(c.type)}
                </Text>
                {c.isOwn && <Text style={styles.ownBadge}>Du</Text>}
              </View>
              <Text style={styles.commentText}>{c.text}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleRate(c._id, i)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    disabled={!canPost}
                  >
                    <Ionicons
                      name={i <= c.userRating ? "star" : "star-outline"}
                      size={18}
                      color={i <= c.userRating ? YELLOW : "#bbb"}
                    />
                  </TouchableOpacity>
                ))}
                <Text style={styles.ratingText}>
                  {c.averageRating > 0 ? c.averageRating.toFixed(1) : "—"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
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
  title: { fontSize: 17, fontWeight: "800", color: "#111" },

  list: { gap: 8 },
  empty: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingVertical: 20,
  },
  commentCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  typeLabel: { fontSize: 12, fontWeight: "700" },
  ownBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: BLUE,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: "auto",
  },
  commentText: { fontSize: 14, color: "#222", lineHeight: 20 },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
    marginLeft: 6,
  },

  composer: { gap: 8, paddingTop: 4 },
  typeRow: { flexDirection: "row", gap: 8 },
  typePill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  typePillText: { fontSize: 13, fontWeight: "700", color: "#555" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#f9fafb",
    maxHeight: 90,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: YELLOW,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: RED, fontSize: 13 },
  closedNotice: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    paddingVertical: 8,
  },

  modCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  modTitle: { fontSize: 13, fontWeight: "700" },
  modMessage: { fontSize: 12 },
  modLegal: { fontSize: 11, color: "#666", fontStyle: "italic" },
  modRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  modCancel: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  modCancelText: { fontSize: 13, fontWeight: "700", color: "#555" },
  modConfirm: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  modConfirmText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
