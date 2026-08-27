import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INTEREST_TO_CATEGORIES, INTEREST_AREAS } from "@repo/types";
import { useRouter } from "expo-router";
import { useAuth } from "./auth-context";
import { getItem, setItem, STORAGE_PHONE } from "./storage";
import { ApiError, apiClient, BASE_URL } from "./api";
import { EmailClaimSheet } from "./EmailClaimSheet";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

export const STORAGE_INTERESTS = "user_interests";
export const STORAGE_INTERESTS_ONLY = "user_interests_only";

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
  const { user, logout } = useAuth();
  const router = useRouter();
  const [localInterests, setLocalInterests] = useState<string[]>(["budget"]);
  const [localOnly, setLocalOnly] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [claimEmail, setClaimEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const saved = await getItem(STORAGE_INTERESTS);
      if (saved) setLocalInterests(JSON.parse(saved));
      const savedOnly = await getItem(STORAGE_INTERESTS_ONLY);
      if (savedOnly !== null) setLocalOnly(savedOnly === "true");
      const savedPhone = await getItem(STORAGE_PHONE);
      setPhoneNumber(savedPhone ?? "");
      setContactError(null);
      // Read from the account rather than from storage: a BankID account may
      // have been created on another device, and the address belongs to the
      // account rather than to this phone.
      try {
        const me = await apiClient<{ user: { email: string | null } | null }>(
          "/api/mobile/user/me",
        );
        setEmail(me.user?.email ?? "");
      } catch {
        // Signed out or offline — leave the field blank.
      }
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
    const trimmedPhone = phoneNumber.trim();
    await setItem(STORAGE_PHONE, trimmedPhone);
    // Persist to DB — deduplicate since multiple keys can map to the same category
    const dbInterests = [
      ...new Set(
        localInterests.flatMap((key) => INTEREST_TO_CATEGORIES[key] ?? []),
      ),
    ];
    try {
      await apiClient("/api/mobile/user/interests", {
        method: "POST",
        body: JSON.stringify({ interests: dbInterests }),
      });
    } catch {
      // fail silently — local preferences still saved
    }
    try {
      await apiClient("/api/mobile/user/phone", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: trimmedPhone }),
      });
    } catch {
      // fail silently — local value still saved
    }

    // The email is not mirrored locally, so a rejection here has to be shown
    // rather than swallowed: otherwise the sheet closes and the address the
    // user typed is simply gone. The common rejection is a real one — the
    // address already belongs to another account.
    try {
      await apiClient("/api/mobile/user/email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch (err) {
      // The address belongs to an account that predates BankID — almost always
      // this person's own. Offer the merge instead of reporting a failure; it
      // is verified, so they still have to prove the mailbox.
      if (err instanceof ApiError && err.body?.code === "MERGE_AVAILABLE") {
        setClaimEmail(email.trim());
        return;
      }
      setContactError(
        (err as Error).message || "E-postadressen kunde inte sparas.",
      );
      return;
    }

    onClose();
    onSaved?.();
  }

  return (
    <>
      {/* A sibling of the settings sheet, not a child: nested Modals stack
          unreliably in React Native, and on Android the inner one can end up
          behind the outer backdrop. */}
      <EmailClaimSheet
        visible={!!claimEmail}
        mode="merge"
        initialEmail={claimEmail ?? ""}
        onClose={() => setClaimEmail(null)}
        onClaimed={() => {
          setClaimEmail(null);
          setContactError(null);
          onClose();
          onSaved?.();
        }}
      />
      <Modal
        visible={visible && !claimEmail}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={st.backdrop}>
              {/* Painted behind the sheet, anchored to the bottom. When the
                  keyboard lifts the sheet, this is what shows in the gap —
                  without it the app is visible underneath and the sheet looks
                  detached. */}
              <View pointerEvents="none" style={st.keyboardFiller} />
              <TouchableWithoutFeedback>
                <View style={[st.sheet, { paddingBottom: 0 }]}>
                  <View style={st.handle} />
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                      paddingBottom: insets.bottom + 20,
                    }}
                  >
                    <View style={st.introBox}>
                      <View style={st.introRow}>
                        <Text style={st.introTitle}>INSTÄLLNINGAR</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                          <Ionicons name="close" size={22} color="#666" />
                        </TouchableOpacity>
                      </View>
                      <Text style={st.introText}>
                        Ingen är intresserad av allt. Välj ett eller flera
                        områden och spara.
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
                            <View
                              style={[st.checkbox, checked && st.checkboxOn]}
                            >
                              {checked && (
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color="#fff"
                                />
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
                        <Text style={st.toggleLabel}>
                          Visa bara mina intressen
                        </Text>
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

                    <View style={st.divider} />

                    <View style={{ marginBottom: 4 }}>
                      <Text style={st.toggleLabel}>E-post</Text>
                      <Text style={st.toggleHint}>
                        Så att vi kan nå dig. Krävs för medlemskap. Du loggar
                        alltid in med BankID — aldrig med e-post.
                      </Text>
                      <TextInput
                        style={st.phoneInput}
                        value={email}
                        onChangeText={(v) => {
                          setEmail(v);
                          setContactError(null);
                        }}
                        placeholder="namn@exempel.se"
                        placeholderTextColor="#aaa"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        returnKeyType="done"
                        onSubmitEditing={handleSave}
                      />
                      {contactError ? (
                        <Text style={st.contactError}>{contactError}</Text>
                      ) : null}
                    </View>

                    <View style={st.divider} />

                    <View style={{ marginBottom: 4 }}>
                      <Text style={st.toggleLabel}>Mobilnummer</Text>
                      <Text style={st.toggleHint}>
                        Få en sms-påminnelse inför viktiga omröstningar, t.ex.
                        valet den 13 september.
                      </Text>
                      <TextInput
                        style={st.phoneInput}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="07XX-XXX XX XX"
                        placeholderTextColor="#aaa"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        returnKeyType="done"
                        onSubmitEditing={handleSave}
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

                    {/* An anonymous viewer reaches this sheet too — the settings
                    themselves are local — so it must offer the way in rather
                    than a way out of a session that does not exist. */}
                    {user ? (
                      <TouchableOpacity
                        style={st.logoutBtn}
                        onPress={() => {
                          onClose();
                          logout();
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="log-out-outline"
                          size={20}
                          color="#dc2626"
                        />
                        <Text style={st.logoutBtnText}>Logga ut</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={st.loginBtn}
                        onPress={() => {
                          onClose();
                          router.push("/(auth)/login");
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="log-in-outline"
                          size={20}
                          color={BLUE}
                        />
                        <Text style={st.loginBtnText}>Logga in med BankID</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  keyboardFiller: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
    backgroundColor: "#fff",
  },
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
  contactError: { color: "#dc2626", fontSize: 13, marginTop: 6 },
  phoneInput: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#222",
    marginTop: 10,
  },
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
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f5a623",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  loginBtnText: { color: BLUE, fontSize: 16, fontWeight: "800" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fca5a5",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  logoutBtnText: { color: "#dc2626", fontSize: 16, fontWeight: "700" },
});
