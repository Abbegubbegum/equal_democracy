import { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GEOGRAPHIC_CATEGORIES, THEMATIC_CATEGORIES } from "@repo/types";
import { apiClient } from "./api";
import { addStars, isFirstInterestsSave, markInterestsSaved } from "./stars";
import CelebrationModal from "./CelebrationModal";
import { markProfileCompleted } from "./onboarding";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function InterestsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [celebration, setCelebration] = useState(false);

  function toggle(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function save() {
    setSaving(true);
    try {
      await apiClient("/api/mobile/user/interests", {
        method: "POST",
        body: JSON.stringify({ interests: selected }),
      });
      await markProfileCompleted();
      const firstTime = await isFirstInterestsSave();
      if (firstTime) {
        await addStars(2);
        await markInterestsSaved();
        setCelebration(true);
      } else {
        onClose();
      }
    } catch {
      // fail silently — profile state is saved locally regardless
      await markProfileCompleted();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Ionicons name="options-outline" size={22} color={BLUE} />
              </View>
              <Text style={styles.title}>Anpassa din app</Text>
            </View>

            <Text style={styles.subtitle}>
              Välj vad du bryr dig om — då får du bara notiser som är relevanta
              för dig. Du kan ändra detta när som helst.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              <Text style={styles.groupLabel}>Plats i Vallentuna</Text>
              <View style={styles.chipRow}>
                {GEOGRAPHIC_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      selected.includes(cat) && styles.chipOn,
                    ]}
                    onPress={() => toggle(cat)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected.includes(cat) && styles.chipTextOn,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.groupLabel, { marginTop: 16 }]}>
                Ämnesområde
              </Text>
              <View style={styles.chipRow}>
                {THEMATIC_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      selected.includes(cat) && styles.chipOn,
                    ]}
                    onPress={() => toggle(cat)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected.includes(cat) && styles.chipTextOn,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={BLUE} />
              ) : (
                <Text style={styles.saveBtnText}>
                  {selected.length > 0
                    ? `Spara ${selected.length} intressen`
                    : "Spara (alla kategorier)"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onClose}
              hitSlop={12}
            >
              <Text style={styles.skipText}>Inte nu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CelebrationModal
        visible={celebration}
        title="Profil sparad! +2 stjärnor"
        subtitle="Nu vet vi vad du bryr dig om. Du får bara notiser som är relevanta för dig."
        stars={2}
        onDone={() => {
          setCelebration(false);
          onClose();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 19, fontWeight: "800", color: "#111" },
  subtitle: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 20 },
  scroll: { flexGrow: 0 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  chipOn: { backgroundColor: BLUE, borderColor: BLUE },
  chipText: { fontSize: 13, color: "#555", fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  saveBtn: {
    backgroundColor: YELLOW,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: BLUE, fontSize: 15, fontWeight: "800" },
  skipBtn: { alignItems: "center", paddingVertical: 14 },
  skipText: { color: "#aaa", fontSize: 14 },
});
