import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { apiClient, BASE_URL, getAccessToken } from "../../lib/api";
import CelebrationModal from "../../lib/CelebrationModal";
import { addStars } from "../../lib/stars";

interface CitizenProposal {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  averageRating: number;
  ratingCount: number;
  userRating: number;
}

// ─── Full-screen proposal block ───────────────────────────────────────────────

function ProposalBlock({
  proposal,
  rank,
  height,
  insetTop,
  insetBottom,
  onRated,
}: {
  proposal: CitizenProposal;
  rank: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  onRated: (id: string, userRating: number, averageRating: number, ratingCount: number) => void;
}) {
  const [localRating, setLocalRating] = useState(proposal.userRating);
  const [localAvg, setLocalAvg]       = useState(proposal.averageRating);
  const [localCount, setLocalCount]   = useState(proposal.ratingCount);
  const [expanded, setExpanded]       = useState(false);
  const [busy, setBusy]               = useState(false);

  async function handleRate(stars: number) {
    if (busy) return;
    setBusy(true);
    const prev = localRating;
    setLocalRating(stars);
    try {
      const result = await apiClient<{ averageRating: number; ratingCount: number; userRating: number }>(
        "/api/mobile/citizen-proposals/rate",
        { method: "POST", body: JSON.stringify({ proposalId: proposal.id, rating: stars }) }
      );
      setLocalAvg(result.averageRating);
      setLocalCount(result.ratingCount);
      onRated(proposal.id, stars, result.averageRating, result.ratingCount);
    } catch {
      setLocalRating(prev);
    } finally {
      setBusy(false);
    }
  }

  if (!height) return null;

  const bgUri = proposal.imageUrl ? `${BASE_URL}${proposal.imageUrl}` : null;

  return (
    <View style={{ width: "100%", height }}>
      {/* Background */}
      {bgUri
        ? <Image source={{ uri: bgUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, styles.noImageBg]} />
      }
      <View style={styles.overlay} />

      {/* Rank badge — top-left */}
      <View style={[styles.rankBadge, { top: insetTop + 16 }]}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>

      {/* Text card — centred in the image */}
      <View style={[styles.contentWrapper, { paddingTop: insetTop + 60, paddingBottom: insetBottom + 110 }]}>
        <View style={styles.contentCard}>
          <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.85}>
            <Text style={styles.proposalLabel}>Förslag:</Text>
            <Text style={styles.proposalTitle}>{proposal.title}</Text>
          </TouchableOpacity>

          {expanded && (
            <Text style={styles.proposalDescription}>{proposal.description}</Text>
          )}

          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded((e) => !e)}>
            <Text style={styles.expandHint}>{expanded ? "Dölj ▲" : "Läs mer ▼"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stars — own zone pinned to bottom, fully separated from the text card */}
      <View style={[styles.starsArea, { paddingBottom: insetBottom + 72 }]}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handleRate(i)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={i <= localRating ? "star" : "star-outline"}
              size={34}
              color={YELLOW}
            />
          </TouchableOpacity>
        ))}
        <Text style={styles.ratingText}>
          {localCount > 0
            ? `${localAvg.toFixed(1)} · ${localCount} röst${localCount !== 1 ? "er" : ""}`
            : "Ingen röstat än"}
        </Text>
      </View>
    </View>
  );
}

// ─── Submit modal ─────────────────────────────────────────────────────────────

function SubmitModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (p: CitizenProposal) => void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri]       = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { setError("Appen behöver tillgång till ditt fotobibliotek"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const compressed = await manipulateAsync(
      asset.uri,
      asset.width > 1200 ? [{ resize: { width: 1200 } }] : [],
      { compress: 0.75, format: SaveFormat.JPEG }
    );
    setImageUri(compressed.uri);
  }

  async function submit() {
    if (!title.trim()) { setError("Ange en titel"); return; }
    if (!description.trim()) { setError("Ange en beskrivning"); return; }
    setError(null);
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      if (imageUri) {
        fd.append("image", { uri: imageUri, type: "image/jpeg", name: "photo.jpg" } as any);
      }
      const res = await fetch(`${BASE_URL}/api/mobile/citizen-proposals`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Något gick fel");
      }
      onSuccess(await res.json());
    } catch (e: any) {
      setError(e.message || "Något gick fel");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.handle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Nytt medborgarförslag</Text>
                  <TouchableOpacity onPress={onClose} hitSlop={12}>
                    <Ionicons name="close" size={22} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Titel *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Kortfattad titel på ditt förslag..."
                  placeholderTextColor="#aaa"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={200}
                  returnKeyType="next"
                  autoFocus
                />

                <Text style={styles.inputLabel}>Beskrivning *</Text>
                <TextInput
                  style={[styles.textInput, styles.textInputMulti]}
                  placeholder="Beskriv ditt förslag i detalj..."
                  placeholderTextColor="#aaa"
                  value={description}
                  onChangeText={setDescription}
                  maxLength={2000}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                {imageUri ? (
                  <View style={styles.previewWrapper}>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)} hitSlop={8}>
                      <Ionicons name="close-circle" size={22} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                    <Ionicons name="image-outline" size={18} color="#555" />
                    <Text style={styles.imagePickerText}>Lägg till bild (valfritt)</Text>
                  </TouchableOpacity>
                )}

                {!!error && <Text style={styles.formError}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={submit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color={BLUE} />
                    : <><Ionicons name="send" size={16} color={BLUE} /><Text style={styles.submitBtnText}>Skicka in förslag</Text></>
                  }
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProposalsScreen() {
  const insets = useSafeAreaInsets();
  const [proposals, setProposals]   = useState<CitizenProposal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [containerH, setContainerH] = useState(0);
  const [celebration, setCelebration] = useState(false);
  const currentIdxRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const initialScrollDone = useRef(false);

  const loopedProposals = useMemo(
    () => (proposals.length > 1 ? [...proposals, ...proposals, ...proposals] : proposals),
    [proposals]
  );

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (proposals.length > 1 && containerH > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      const midIdx = proposals.length;
      currentIdxRef.current = midIdx;
      scrollRef.current?.scrollTo({ y: midIdx * containerH, animated: false });
    }
  }, [proposals.length, containerH]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<CitizenProposal[]>("/api/mobile/citizen-proposals");
      setProposals(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRated(id: string, userRating: number, averageRating: number, ratingCount: number) {
    setProposals((prev) =>
      [...prev.map((p) => p.id === id ? { ...p, userRating, averageRating, ratingCount } : p)]
        .sort((a, b) => b.averageRating - a.averageRating || b.ratingCount - a.ratingCount)
    );
  }

  async function handleCreated(proposal: CitizenProposal) {
    setProposals((prev) => [proposal, ...prev]);
    setShowModal(false);
    await addStars(5);
    setCelebration(true);
  }

  function handleMomentumScrollEnd(e: any) {
    const n = proposals.length;
    if (n === 0 || containerH === 0) return;
    const rawIdx = Math.round(e.nativeEvent.contentOffset.y / containerH);
    const clampedIdx = n > 1
      ? Math.max(0, Math.min(n * 3 - 1, rawIdx))
      : Math.max(0, Math.min(n - 1, rawIdx));
    currentIdxRef.current = clampedIdx;
    // Infinite loop: silently jump to the middle copy when near either end
    if (n > 1) {
      let jumpIdx: number | null = null;
      if (clampedIdx < n) jumpIdx = clampedIdx + n;
      else if (clampedIdx >= 2 * n) jumpIdx = clampedIdx - n;
      if (jumpIdx !== null) {
        currentIdxRef.current = jumpIdx;
        scrollRef.current?.scrollTo({ y: jumpIdx * containerH, animated: false });
      }
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Försök igen</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (proposals.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="bulb-outline" size={56} color="#ccc" />
        <Text style={styles.emptyTitle}>Inga medborgarförslag</Text>
        <Text style={styles.emptyText}>Var den första att lämna ett förslag.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.retryText}>Lämna ett förslag</Text>
        </TouchableOpacity>
        {showModal && <SubmitModal onClose={() => setShowModal(false)} onSuccess={handleCreated} />}
      </View>
    );
  }

  return (
    <View style={styles.screen} onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}>
      <ScrollView
        ref={scrollRef}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {loopedProposals.map((proposal, index) => (
          <ProposalBlock
            key={index}
            proposal={proposal}
            rank={(index % Math.max(proposals.length, 1)) + 1}
            height={containerH}
            insetTop={insets.top}
            insetBottom={insets.bottom}
            onRated={handleRated}
          />
        ))}
      </ScrollView>

      {/* Floating action button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={BLUE} />
      </TouchableOpacity>

      {showModal && (
        <SubmitModal onClose={() => setShowModal(false)} onSuccess={handleCreated} />
      )}

      <CelebrationModal
        visible={celebration}
        title="Fantastiskt bidrag!"
        subtitle="Du har precis gjort ett riktigt demokratiskt avtryck. Ditt förslag kan förändra Vallentuna!"
        stars={5}
        onDone={() => setCelebration(false)}
      />
    </View>
  );
}

// ─── Constants & styles ───────────────────────────────────────────────────────

const BLUE   = "#002d75";
const YELLOW = "#f5a623";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  // Full-screen block
  noImageBg: { backgroundColor: BLUE },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.40)" },
  rankBadge: {
    position: "absolute", right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  rankText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  // Text card centred in the image
  contentWrapper: {
    flex: 1, justifyContent: "center", paddingHorizontal: 24,
  },
  contentCard: {
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: 20, padding: 24, gap: 16,
  },
  proposalLabel: {
    fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4,
  },
  proposalTitle: {
    fontSize: 26, fontWeight: "900", color: "#fff",
    lineHeight: 33, letterSpacing: 0.2,
  },
  proposalDescription: {
    fontSize: 15, color: "rgba(255,255,255,0.90)", lineHeight: 23,
  },
  expandBtn: { paddingVertical: 6 },
  expandHint: { fontSize: 19, color: YELLOW, fontWeight: "800" },

  // Stars zone — fully separate from text card
  starsArea: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingTop: 14,
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  ratingText: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginLeft: 4 },

  // Loading / error / empty states
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 12, backgroundColor: "#f4f6fb", paddingHorizontal: 32,
  },
  errorText:  { color: "#dc2626", fontSize: 14, textAlign: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#555" },
  emptyText:  { fontSize: 14, color: "#aaa", textAlign: "center" },
  retryBtn:   { backgroundColor: BLUE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText:  { color: "#fff", fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: YELLOW,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },

  // Modal
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  kav:      { justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, gap: 8,
  },
  handle: {
    width: 40, height: 4, backgroundColor: "#ddd",
    borderRadius: 2, alignSelf: "center", marginBottom: 4,
  },
  sheetHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sheetTitle:   { fontSize: 17, fontWeight: "800", color: "#111" },
  inputLabel:   { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 4 },
  textInput: {
    borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: "#111", backgroundColor: "#f9fafb",
  },
  textInputMulti: { minHeight: 100, textAlignVertical: "top" },
  imagePickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "dashed",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "#f9fafb",
  },
  imagePickerText: { fontSize: 14, color: "#555" },
  previewWrapper:  { position: "relative" },
  previewImage:    { width: "100%", height: 140, borderRadius: 10 },
  removeImageBtn:  { position: "absolute", top: 6, right: 6, backgroundColor: "#fff", borderRadius: 11 },
  formError:       { color: "#dc2626", fontSize: 13 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: YELLOW, paddingVertical: 14, borderRadius: 14, gap: 8, marginTop: 4,
  },
  submitBtnText: { color: BLUE, fontSize: 15, fontWeight: "800" },
});
