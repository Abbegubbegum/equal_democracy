import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BLUE = "#002d75";
const YELLOW = "#f5a623";
const GREEN = "#16a34a";

export interface MajDuplicate {
  id: string;
  title: string;
  relation: "same" | "more_specific" | "more_general";
  reason: string;
}

export interface MajReview {
  corrected: string | null;
  concise: string | null;
  duplicates?: MajDuplicate[];
}

const RELATION_LABEL: Record<MajDuplicate["relation"], string> = {
  same: "Samma idé",
  more_specific: "Mer specifik",
  more_general: "Mer allmän",
};

/**
 * MAJ's writing-help sheet shown when a user posts a proposal/argument on
 * mobile — the RN twin of apps/web/components/MajReviewSheet.tsx. Suggests a
 * corrected + a concise version, (proposals) an image prompt, and (proposals)
 * flags likely duplicates. "Publicera" posts the working text (original unless a
 * suggestion was applied). Warn-but-allow: duplicates never block posting.
 */
export default function MajReviewSheet({
  originalText,
  review,
  kind,
  hasImage = false,
  onPickImage,
  onPublish,
  onCancel,
}: {
  originalText: string;
  review: MajReview;
  kind: "proposal" | "argument";
  hasImage?: boolean;
  onPickImage?: () => void;
  onPublish: (finalText: string) => void;
  onCancel: () => void;
}) {
  const [workingText, setWorkingText] = useState(originalText);
  const [applied, setApplied] = useState<"corrected" | "concise" | null>(null);

  const showImageTip = kind === "proposal";
  const duplicates = review.duplicates ?? [];
  const hasDuplicates = duplicates.length > 0;
  const publishLabel = hasDuplicates
    ? "Lämna ändå"
    : kind === "proposal"
      ? "Publicera förslag"
      : "Publicera argument";
  const nothingToImprove =
    !hasDuplicates && !review.corrected && !review.concise && !showImageTip;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="sparkles" size={18} color={YELLOW} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle}>MAJ har några tips</Text>
                  <Text style={styles.headerSub}>Innan du publicerar</Text>
                </View>
                <TouchableOpacity onPress={onCancel} hitSlop={12}>
                  <Ionicons
                    name="close"
                    size={22}
                    color="rgba(255,255,255,0.8)"
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
              >
                {hasDuplicates && (
                  <View style={styles.dupCard}>
                    <View style={styles.tipLabelRow}>
                      <Text>⚠️</Text>
                      <Text style={styles.dupLabel}>Kan redan finnas</Text>
                    </View>
                    <Text style={styles.dupIntro}>
                      Rösta hellre på ett befintligt förslag än att dela upp
                      rösterna på dubletter.
                    </Text>
                    {duplicates.map((d) => (
                      <View key={d.id} style={styles.dupItem}>
                        <View style={styles.dupItemHeader}>
                          <Text style={styles.relationBadge}>
                            {RELATION_LABEL[d.relation]}
                          </Text>
                        </View>
                        <Text style={styles.dupTitle}>{d.title}</Text>
                        {!!d.reason && (
                          <Text style={styles.dupReason}>{d.reason}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {review.corrected && (
                  <View style={styles.tip}>
                    <View style={styles.tipLabelRow}>
                      <Text>✍️</Text>
                      <Text style={styles.tipLabel}>Stavning & språk</Text>
                    </View>
                    <Text style={styles.tipText}>{review.corrected}</Text>
                    <TipUse
                      applied={applied === "corrected"}
                      label="Använd MAJ:s text"
                      onUse={() => {
                        setWorkingText(review.corrected as string);
                        setApplied("corrected");
                      }}
                    />
                  </View>
                )}

                {review.concise && (
                  <View style={styles.tip}>
                    <View style={styles.tipLabelRow}>
                      <Text>✂️</Text>
                      <Text style={styles.tipLabel}>Kortare & tydligare</Text>
                    </View>
                    <Text style={styles.tipText}>{review.concise}</Text>
                    <TipUse
                      applied={applied === "concise"}
                      label="Använd"
                      onUse={() => {
                        setWorkingText(review.concise as string);
                        setApplied("concise");
                      }}
                    />
                  </View>
                )}

                {showImageTip && (
                  <View style={styles.tip}>
                    <View style={styles.tipLabelRow}>
                      <Text>📷</Text>
                      <Text style={styles.tipLabel}>Lägg till en bild</Text>
                    </View>
                    {hasImage ? (
                      <Text style={styles.imageAdded}>✓ Bild tillagd</Text>
                    ) : (
                      <>
                        <Text style={styles.tipHint}>
                          Förslag med bild får mer uppmärksamhet och fler
                          röster.
                        </Text>
                        {onPickImage && (
                          <TouchableOpacity
                            style={styles.useBtn}
                            onPress={onPickImage}
                          >
                            <Text style={styles.useBtnText}>Välj bild</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}

                {nothingToImprove && (
                  <Text style={styles.nothing}>
                    MAJ hittade inget att förbättra. 👍
                  </Text>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => onPublish(workingText)}
                >
                  <Text style={styles.publishText}>{publishLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onCancel} hitSlop={8}>
                  <Text style={styles.cancelText}>Avbryt</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function TipUse({
  applied,
  label,
  onUse,
}: {
  applied: boolean;
  label: string;
  onUse: () => void;
}) {
  if (applied) {
    return <Text style={styles.appliedText}>✓ Använd</Text>;
  }
  return (
    <TouchableOpacity style={styles.useBtn} onPress={onUse}>
      <Text style={styles.useBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "85%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: BLUE,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,166,35,0.18)",
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.5)",
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },

  body: { padding: 18, gap: 12 },

  tip: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  tipLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#9ca3af",
  },
  tipText: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 21,
    backgroundColor: "#f7f8fb",
    borderRadius: 10,
    padding: 12,
  },
  tipHint: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  imageAdded: { fontSize: 14, color: GREEN, fontWeight: "700" },

  useBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  useBtnText: { fontSize: 13, fontWeight: "800", color: BLUE },
  appliedText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
    color: GREEN,
  },

  dupCard: {
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  dupLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#b45309",
  },
  dupIntro: { fontSize: 14, color: "#78350f", lineHeight: 20 },
  dupItem: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  dupItemHeader: { flexDirection: "row" },
  relationBadge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#b45309",
    backgroundColor: "#fef3c7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  dupTitle: { fontSize: 14, fontWeight: "800", color: "#1f2937" },
  dupReason: { fontSize: 12, color: "#6b7280", lineHeight: 17 },

  nothing: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 8,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  publishBtn: {
    flex: 1,
    backgroundColor: YELLOW,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  publishText: { fontSize: 15, fontWeight: "800", color: BLUE },
  cancelText: { fontSize: 14, fontWeight: "700", color: "#6b7280" },
});
