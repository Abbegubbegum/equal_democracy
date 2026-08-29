import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Linking,
  Modal,
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
  // How much room the keyboard is taking, used as padding *inside* the sheet
  // rather than as a translation of it. KeyboardAvoidingView slid the whole
  // sheet upward, which exposed the Info tab behind it; padding grows the
  // scrollable area instead, so the sheet stays anchored and the fields scroll
  // clear of the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Where each contact field sits inside the scroll content, captured on
  // layout. Scrolling to the *end* instead overshot the email field, because
  // the phone field and everything after it are still below it.
  const fieldOffsets = useRef<Record<string, number>>({});

  const [focusedField, setFocusedField] = useState<string | null>(null);

  /**
   * Brings a focused field to the top of the sheet.
   *
   * The scroll is driven by `keyboardHeight` rather than by a timer. A fixed
   * delay was the bug: the padding that makes the scroll possible only exists
   * once `keyboardDidShow` has fired — which on Android can be well past 80ms —
   * so the scroll ran against un-padded content, hit the clamp, and barely
   * moved.
   */
  useEffect(() => {
    if (!focusedField || keyboardHeight === 0) return;
    const y = fieldOffsets.current[focusedField];
    if (y === undefined) return;
    // One frame after the padding lands, so the new content height is measured.
    const t = setTimeout(
      () =>
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }),
      50,
    );
    return () => clearTimeout(t);
  }, [focusedField, keyboardHeight]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
    const next = localInterests.includes(key)
      ? localInterests.filter((k) => k !== key)
      : [...localInterests, key];
    setLocalInterests(next);
    saveInterests(next, localOnly);
  }

  /** Interests + the "only my areas" toggle. Fires on each tap. */
  async function saveInterests(nextInterests: string[], nextOnly: boolean) {
    await setItem(STORAGE_INTERESTS, JSON.stringify(nextInterests));
    await setItem(STORAGE_INTERESTS_ONLY, String(nextOnly));
    // Deduplicated: several interest keys can map to the same category.
    const dbInterests = [
      ...new Set(
        nextInterests.flatMap((key) => INTEREST_TO_CATEGORIES[key] ?? []),
      ),
    ];
    try {
      await apiClient("/api/mobile/user/interests", {
        method: "POST",
        body: JSON.stringify({ interests: dbInterests }),
      });
    } catch {
      // fail silently — the local preference still applies to the feed
    }
    onSaved?.();
  }

  /** The phone field. On blur or Done, not per keystroke. */
  async function savePhone() {
    const trimmedPhone = phoneNumber.trim();
    await setItem(STORAGE_PHONE, trimmedPhone);
    try {
      await apiClient("/api/mobile/user/phone", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: trimmedPhone }),
      });
      setContactError(null);
    } catch (err) {
      setContactError((err as Error).message || "Numret kunde inte sparas.");
    }
  }

  async function saveEmail() {
    // Not mirrored locally, so a rejection has to be shown rather than
    // swallowed — otherwise the address the user typed is simply gone.
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
    setContactError(null);
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
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={st.backdrop}>
            <TouchableWithoutFeedback>
              <View style={[st.sheet, { paddingBottom: 0 }]}>
                <View style={st.handle} />
                <ScrollView
                  ref={scrollRef}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    paddingBottom: insets.bottom + 20 + keyboardHeight,
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
                      onValueChange={(v) => {
                        setLocalOnly(v);
                        saveInterests(localInterests, v);
                      }}
                      trackColor={{ false: "#e5e7eb", true: BLUE }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={st.divider} />

                  <View
                    style={{ marginBottom: 4 }}
                    onLayout={(e) => {
                      fieldOffsets.current.email = e.nativeEvent.layout.y;
                    }}
                  >
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
                      onFocus={() => setFocusedField("email")}
                      onSubmitEditing={saveEmail}
                      onBlur={() => {
                        setFocusedField(null);
                        saveEmail();
                      }}
                    />
                    {contactError ? (
                      <Text style={st.contactError}>{contactError}</Text>
                    ) : null}
                  </View>

                  <View style={st.divider} />

                  <View
                    style={{ marginBottom: 4 }}
                    onLayout={(e) => {
                      fieldOffsets.current.phone = e.nativeEvent.layout.y;
                    }}
                  >
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
                      onFocus={() => setFocusedField("phone")}
                      onSubmitEditing={savePhone}
                      onBlur={() => {
                        setFocusedField(null);
                        savePhone();
                      }}
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
                      <Ionicons name="log-in-outline" size={20} color={BLUE} />
                      <Text style={st.loginBtnText}>Logga in med BankID</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
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
