import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Switch,
  TouchableWithoutFeedback,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ChevronsRight from "../../lib/ChevronsRight";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { getItem, setItem } from "../../lib/storage";
import { BASE_URL } from "../../lib/api";
import { getStars, addStars, isFirstVisit, markFirstVisitSeen, isFirstInterestsSave, markInterestsSaved } from "../../lib/stars";
import CelebrationModal from "../../lib/CelebrationModal";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

const VALUES = [
  {
    icon: "people-outline" as const,
    title: "Medborgardialog",
    text: "Vallentuna framåt ser invånare som delägare av vår kommun. Du ska självklart ha samma rätt i din kommun som en aktieägare.\n\nVi vill göra oss av med självtillräckliga, mobbare och skapa en smartare demokrati där alla samarbetar. Rösta på Vallentuna framåt för att vara med och bestämma i dina frågor.",
  },
  {
    icon: "leaf-outline" as const,
    title: "Hållbar utveckling",
    text: "Vallentuna ska växa in i framtiden och bli en föregångare inom socioteknik.\n\nVi ska bevara naturen och utnyttja teknologin för att skapa ett bra liv för kommande generationer.",
  },
  {
    icon: "sunny-outline" as const,
    title: "Öppenhet och anonymitet",
    text: "Vallentuna framåt bygger på öppenhet och anonymitet. Öppenheten gör korruption och annat mygel omöjlig. Arkivet samlar alla beslut, argument, värderingar och röstsiffror.\n\nMen debatt och omröstning är anonym. Anonymiteten skyddar mot röstköp och åsiktsregistrering.",
  },
  {
    icon: "sparkles" as const,
    title: "XAI",
    text: "XAI är AI som alltid förklarar vad den gör. Den är som en tjänare i bakgrunden som hjälper dig att hitta intressanta frågor eller fysiska träffar med andra som gillar samma sak. Vår lokala XAI kan också sammanfatta information och hjälpa dig skriva bra förslag och inlägg.\n\nDet gör Vallentuna till pionjärer inom AI och politik. Om du tycker att XAI skriver något konstigt så finns det en knapp för att anmäla. Då kan andra se och bedöma om den måste bytas ut. XAI ska förbättra och förenkla demokratin, inte försämra.\n\nVarje år lämnar vår XAI en demokratirapport som mäter maktkoncentrationen i Vallentuna framåt. Vi vill inte ha någon mäktig ledare.",
  },
];

export const INTEREST_AREAS: { key: string; label: string; alwaysOn?: boolean; note?: string; groupLabel?: string }[] = [
  { key: "budget",         label: "Budgeten",                         alwaysOn: true, note: "Alltid aktiv — balanserar övriga intressen" },
  { key: "barn",           label: "Barn och utbildning" },
  { key: "arbete",         label: "Arbete och Näringsliv" },
  { key: "aldre",          label: "Äldre och social gemenskap" },
  { key: "politik",        label: "Politik och Organisation" },
  { key: "infra",          label: "Infrastruktur och Identitet" },
  { key: "kultur",         label: "Kultur och Fritid" },
  { key: "geo_central",    label: "Centrala Vallentuna",              groupLabel: "Geografiska intressen" },
  { key: "geo_lindholmen", label: "Lindholmen och Västra Vallentuna" },
  { key: "geo_karsta",     label: "Kårsta och norra Vallentuna" },
  { key: "geo_karby",      label: "Karby, Brottby, Össeby-Garn" },
];

const STORAGE_INTERESTS = "user_interests";
const STORAGE_INTERESTS_ONLY = "user_interests_only";

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [heroHeight, setHeroHeight] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [interests, setInterests] = useState<string[]>(["budget"]);
  const [interestsOnly, setInterestsOnly] = useState(true);
  const [starCount, setStarCount] = useState(0);
  const [celebration, setCelebration] = useState<{ title: string; subtitle: string; stars: number } | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await getItem(STORAGE_INTERESTS);
      if (saved) setInterests(JSON.parse(saved));
      const savedOnly = await getItem(STORAGE_INTERESTS_ONLY);
      if (savedOnly !== null) setInterestsOnly(savedOnly === "true");
      const stars = await getStars();
      setStarCount(stars);
      if (await isFirstVisit()) {
        await markFirstVisitSeen();
        const newTotal = await addStars(1);
        setStarCount(newTotal);
        setCelebration({ title: "Välkommen till Vallentuna Framåt!", subtitle: "Du är nu en del av en unik demokratirörelse. Bra jobbat — det krävs mod att ta steget!", stars: 1 });
      }
    })();
  }, []);

  async function handleSave(newInterests: string[], newOnly: boolean) {
    setInterests(newInterests);
    setInterestsOnly(newOnly);
    await setItem(STORAGE_INTERESTS, JSON.stringify(newInterests));
    await setItem(STORAGE_INTERESTS_ONLY, String(newOnly));
    setShowSettings(false);
    if (await isFirstInterestsSave()) {
      await markInterestsSaved();
      const newTotal = await addStars(2);
      setStarCount(newTotal);
      setCelebration({ title: "Profilen är klar!", subtitle: "Du vet vad du bryr dig om. Nu kan vi visa dig det som spelar roll för dig.", stars: 2 });
    }
  }

  return (
    <View style={styles.screen}>
      <Image
        source={{ uri: PLACEHOLDER_IMAGE }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: heroHeight }]}
        showsVerticalScrollIndicator={false}
      >
        {user && (
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeText}>
              Välkommen, {user.email.split("@")[0]}!
            </Text>
            <Text style={styles.welcomeSub}>
              Använd flikarna nedan för att delta i demokratin.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Våra kärnvärden</Text>
        {VALUES.map((v) => (
          <View key={v.title} style={styles.valueCard}>
            <View style={styles.valueIcon}>
              <Ionicons name={v.icon} size={22} color={BLUE} />
            </View>
            <View style={styles.valueText}>
              <Text style={styles.valueTitle}>{v.title}</Text>
              <Text style={styles.valueBody}>{v.text}</Text>
            </View>
          </View>
        ))}

        <View style={styles.aboutBox}>
          <Text style={styles.aboutTitle}>Om den här appen</Text>
          <Text style={styles.aboutBody}>
            Rösta, lämna förslag och följ vad som händer i kommunen. Alla medborgare i Vallentuna har rösträtt. Om du röstar in oss den 13 september så framför vi dina åsikter i lokalpolitiken de närmaste fyra åren.
          </Text>
        </View>

        <View style={styles.memberBox}>
          <Text style={styles.memberText}>
            Vill du bli medlem i partiet och få utökad rösträtt?
          </Text>
          <TouchableOpacity
            style={styles.memberBtn}
            onPress={() => router.push("/membership" as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="card-outline" size={18} color={BLUE} />
            <Text style={styles.memberBtnText}>Klicka här</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Fixed blue hero */}
      <View
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
        onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
      >
        {/* Gear icon — upper right corner */}
        <TouchableOpacity
          style={[styles.gearBtn, { top: insets.top + 10 }]}
          onPress={() => setShowSettings(true)}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        {/* Star badge — upper left corner */}
        <View style={[styles.starBadge, { top: insets.top + 14 }]}>
          <Ionicons name="star" size={14} color={YELLOW} />
          <Text style={styles.starBadgeText}>{starCount}</Text>
        </View>

        <View style={styles.logoCircle}>
          <ChevronsRight size={44} color={BLUE} />
        </View>
        <Text style={styles.partyName}>VALLENTUNA</Text>
        <Text style={styles.partySlogan}>Framåt</Text>
        <Text style={styles.heroSub}>
          mot en fri och rättvis demokrati
        </Text>
      </View>

      <SettingsModal
        visible={showSettings}
        initialInterests={interests}
        initialOnly={interestsOnly}
        onSave={handleSave}
        onClose={() => setShowSettings(false)}
      />

      <CelebrationModal
        visible={!!celebration}
        title={celebration?.title ?? ""}
        subtitle={celebration?.subtitle ?? ""}
        stars={celebration?.stars ?? 1}
        onDone={() => setCelebration(null)}
      />
    </View>
  );
}

function SettingsModal({
  visible,
  initialInterests,
  initialOnly,
  onSave,
  onClose,
}: {
  visible: boolean;
  initialInterests: string[];
  initialOnly: boolean;
  onSave: (interests: string[], only: boolean) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [localInterests, setLocalInterests] = useState(initialInterests);
  const [localOnly, setLocalOnly] = useState(initialOnly);

  useEffect(() => {
    if (visible) {
      setLocalInterests(initialInterests);
      setLocalOnly(initialOnly);
    }
  }, [visible]);

  function toggle(key: string) {
    if (key === "budget") return;
    setLocalInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={st.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[st.sheet, { paddingBottom: insets.bottom + 20 }]}>
              <View style={st.handle} />

              <View style={st.header}>
                <Text style={st.title}>Mina inställningar</Text>
                <TouchableOpacity onPress={onClose} hitSlop={12}>
                  <Ionicons name="close" size={22} color="#666" />
                </TouchableOpacity>
              </View>

              <Text style={st.sectionLabel}>Intresseområden</Text>
              <Text style={st.sectionHint}>Välj ett eller flera</Text>

              {INTEREST_AREAS.map((area) => {
                const checked = localInterests.includes(area.key);
                return (
                  <View key={area.key}>
                    {area.groupLabel ? (
                      <View style={st.groupHeader}>
                        <View style={st.divider} />
                        <Text style={st.groupLabelText}>{area.groupLabel}</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={[st.row, area.alwaysOn && st.rowFixed]}
                      onPress={() => toggle(area.key)}
                      activeOpacity={area.alwaysOn ? 1 : 0.7}
                    >
                      <View style={[st.checkbox, checked && st.checkboxOn]}>
                        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <View style={st.rowText}>
                        <Text style={[st.rowLabel, area.alwaysOn && st.rowLabelFixed]}>
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
                  <Text style={st.toggleHint}>Filtrerar notiser och flödet</Text>
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
                  onPress={() => Linking.openURL(`${BASE_URL}${user.isSuperAdmin ? "/admin" : "/manage-sessions"}`)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  <Text style={st.adminBtnText}>Admin</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={st.saveBtn}
                onPress={() => onSave(localInterests, localOnly)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color={BLUE} />
                <Text style={st.saveBtnText}>Spara inställningar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  scroll: { flex: 1 },
  container: { paddingBottom: 40 },

  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: BLUE,
    alignItems: "center",
    paddingBottom: 28,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  gearBtn: {
    position: "absolute",
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  starBadge: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 1,
  },
  starBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: YELLOW,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  partyName: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  partySlogan: { color: YELLOW, fontSize: 24, fontWeight: "600", marginTop: -2, marginBottom: 12 },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 14, textAlign: "center", lineHeight: 20 },

  welcomeBox: {
    margin: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: YELLOW,
  },
  welcomeText: { fontSize: 16, fontWeight: "700", color: BLUE },
  welcomeSub: { fontSize: 13, color: "#666", marginTop: 4 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  valueCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.92)",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef1fa",
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: { flex: 1 },
  valueTitle: { fontSize: 14, fontWeight: "700", color: "#222", marginBottom: 3 },
  valueBody: { fontSize: 13, color: "#555", lineHeight: 18 },

  aboutBox: {
    margin: 16,
    marginTop: 8,
    backgroundColor: "rgba(0,45,117,0.88)",
    borderRadius: 12,
    padding: 20,
  },
  aboutTitle: { color: YELLOW, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  aboutBody: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 20 },

  memberBox: {
    margin: 16,
    marginTop: 0,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    padding: 20,
    gap: 14,
    alignItems: "flex-start",
  },
  memberText: { fontSize: 15, color: "#222", lineHeight: 22 },
  memberBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: YELLOW,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  memberBtnText: { color: BLUE, fontSize: 15, fontWeight: "800" },
});

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 2,
  },
  handle: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "800", color: "#111" },

  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  sectionHint: { fontSize: 12, color: "#aaa", marginBottom: 10 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowFixed: { backgroundColor: "rgba(0,45,117,0.04)", marginHorizontal: -20, paddingHorizontal: 20, borderRadius: 0 },
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

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#e5e7eb", marginVertical: 12 },
  groupHeader: { paddingTop: 4, paddingBottom: 2 },
  groupLabelText: { fontSize: 13, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
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
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: BLUE, borderRadius: 14, paddingVertical: 14, gap: 8,
  },
  adminBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
