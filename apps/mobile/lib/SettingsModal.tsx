import { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "./auth-context";
import { getItem, setItem } from "./storage";
import { BASE_URL } from "./api";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

export const STORAGE_INTERESTS = "user_interests";
export const STORAGE_INTERESTS_ONLY = "user_interests_only";

export const INTEREST_AREAS: {
  key: string;
  label: string;
  alwaysOn?: boolean;
  note?: string;
  groupLabel?: string;
}[] = [
  {
    key: "budget",
    label: "Budgeten",
    alwaysOn: true,
    note: "Alltid aktiv — balanserar övriga intressen",
  },
  { key: "barn", label: "Barn och utbildning" },
  { key: "arbete", label: "Arbete och Näringsliv" },
  { key: "aldre", label: "Äldre och social gemenskap" },
  { key: "politik", label: "Politik och Organisation" },
  { key: "infra", label: "Infrastruktur och Identitet" },
  { key: "kultur", label: "Kultur och Fritid" },
  {
    key: "geo_central",
    label: "Centrala Vallentuna",
    groupLabel: "Geografiska intressen",
  },
  { key: "geo_lindholmen", label: "Lindholmen och Västra Vallentuna" },
  { key: "geo_karsta", label: "Kårsta och norra Vallentuna" },
  { key: "geo_karby", label: "Karby, Brottby, Össeby-Garn" },
];

export function SettingsModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [localInterests, setLocalInterests] = useState<string[]>(["budget"]);
  const [localOnly, setLocalOnly] = useState(true);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const saved = await getItem(STORAGE_INTERESTS);
      if (saved) setLocalInterests(JSON.parse(saved));
      const savedOnly = await getItem(STORAGE_INTERESTS_ONLY);
      if (savedOnly !== null) setLocalOnly(savedOnly === "true");
    })();
  }, [visible]);

  function toggle(key: string) {
    if (key === "budget") return;
    setLocalInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function handleSave() {
    await setItem(STORAGE_INTERESTS, JSON.stringify(localInterests));
    await setItem(STORAGE_INTERESTS_ONLY, String(localOnly));
    onClose();
    onSaved?.();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={st.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[st.sheet, { paddingBottom: 0 }]}>
              <View style={st.handle} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              >
                <View style={st.introBox}>
                  <View style={st.introRow}>
                    <Text style={st.introTitle}>INSTÄLLNINGAR</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={12}>
                      <Ionicons name="close" size={22} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <Text style={st.introText}>
                    Ingen är intresserad av allt. Välj ett eller flera områden
                    och spara.
                  </Text>
                </View>

                {INTEREST_AREAS.map((area) => {
                  const checked = localInterests.includes(area.key);
                  return (
                    <View key={area.key}>
                      {area.groupLabel ? (
                        <View style={st.groupHeader}>
                          <View style={st.divider} />
                          <Text style={st.groupLabelText}>
                            {area.groupLabel}
                          </Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={[st.row, area.alwaysOn && st.rowFixed]}
                        onPress={() => toggle(area.key)}
                        activeOpacity={area.alwaysOn ? 1 : 0.7}
                      >
                        <View style={[st.checkbox, checked && st.checkboxOn]}>
                          {checked && (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                        </View>
                        <View style={st.rowText}>
                          <Text
                            style={[
                              st.rowLabel,
                              area.alwaysOn && st.rowLabelFixed,
                            ]}
                          >
                            {area.label}
                          </Text>
                          {area.note ? (
                            <Text style={st.rowNote}>{area.note}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                <View style={st.divider} />

                <View style={st.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.toggleLabel}>Visa bara mina intressen</Text>
                    <Text style={st.toggleHint}>
                      Filtrerar notiser och flödet
                    </Text>
                  </View>
                  <Switch
                    value={localOnly}
                    onValueChange={setLocalOnly}
                    trackColor={{ false: "#e5e7eb", true: BLUE }}
                    thumbColor="#fff"
                  />
                </View>

                {user?.isAdmin && (
                  <TouchableOpacity
                    style={st.adminBtn}
                    onPress={() =>
                      Linking.openURL(
                        `${BASE_URL}${user.isSuperAdmin ? "/admin" : "/manage-sessions"}`,
                      )
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color="#fff"
                    />
                    <Text style={st.adminBtnText}>Admin</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={st.saveBtn}
                  onPress={handleSave}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={BLUE}
                  />
                  <Text style={st.saveBtnText}>Spara inställningar</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "88%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  introBox: {
    backgroundColor: "rgba(0,45,117,0.06)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  introRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: BLUE,
    letterSpacing: 1.2,
  },
  introText: { fontSize: 14, color: "#555", lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowFixed: {
    backgroundColor: "rgba(0,45,117,0.04)",
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: BLUE, borderColor: BLUE },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, color: "#222", fontWeight: "600" },
  rowLabelFixed: { color: BLUE, fontWeight: "700" },
  rowNote: { fontSize: 11, color: "#888", marginTop: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e7eb",
    marginVertical: 12,
  },
  groupHeader: { paddingTop: 4, paddingBottom: 2 },
  groupLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: "#222" },
  toggleHint: { fontSize: 12, color: "#aaa", marginTop: 2 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    paddingVertical: 15,
    borderRadius: 14,
    gap: 8,
    marginTop: 14,
  },
  saveBtnText: { color: BLUE, fontSize: 16, fontWeight: "800" },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  adminBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
