import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getStars,
  addStars,
  isFirstVisit,
  markFirstVisitSeen,
  isFirstInterestsSave,
  markInterestsSaved,
} from "../../lib/stars";
import CelebrationModal from "../../lib/CelebrationModal";
import { SettingsModal } from "../../lib/SettingsModal";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

const VALUES = [
  {
    icon: "people-outline" as const,
    title: "INFLYTANDE",
    text: "Du som bor i Vallentuna ska ha samma rätt att påverka här som en aktieägare. Swipa, scrolla och rösta för att vara med.",
  },
  {
    icon: "leaf-outline" as const,
    title: "UTVECKLING",
    text: "Vallentuna ska växa in i framtiden och bli föregångare inom sociotekniska innovationer. Vi ska också bevara naturen och skapa ett bra liv för kommande generationer.",
  },
  {
    icon: "sunny-outline" as const,
    title: "POLICY",
    text: "För att motverka maktmissbruk är appen anonym. Det skyddar mot personpåhopp, korruption och åsiktsregistrering.",
  },
  {
    icon: "sparkles" as const,
    title: "XAI",
    text: "XAI är en betjänt som hjälper dig att göra rätt, men det är du som bestämmer. Gör XAI något konstigt så finns det en anmälningsknapp. Tryck så granskar vi den.\n\nVarje år lämnar XAI en demokratirapport som mäter maktkoncentrationen i lokalpartiet. Vi vill inte ha någon mäktig ledare utan mäktiga medborgare.",
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [heroHeight, setHeroHeight] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [starCount, setStarCount] = useState(0);
  const [celebration, setCelebration] = useState<{
    title: string;
    subtitle: string;
    stars: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const stars = await getStars();
      setStarCount(stars);
      if (await isFirstVisit()) {
        await markFirstVisitSeen();
        const newTotal = await addStars(1);
        setStarCount(newTotal);
        setCelebration({
          title: "Välkommen till Vallentuna Framåt!",
          subtitle:
            "Du är nu en del av en unik demokratirörelse. Bra jobbat — det krävs mod att ta steget!",
          stars: 1,
        });
      }
    })();
  }, []);

  async function handleSaved() {
    if (await isFirstInterestsSave()) {
      await markInterestsSaved();
      const newTotal = await addStars(2);
      setStarCount(newTotal);
      setCelebration({
        title: "Profilen är klar!",
        subtitle:
          "Du vet vad du bryr dig om. Nu kan vi visa dig det som spelar roll för dig.",
        stars: 2,
      });
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
            Rösta, lämna förslag och följ vad som händer i kommunen. Alla
            medborgare i Vallentuna har rösträtt. Om du röstar in oss den 13
            september så framför vi dina åsikter i lokalpolitiken de närmaste
            fyra åren.
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
          <Ionicons
            name="settings-outline"
            size={24}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>

        {/* Star badge — upper left corner */}
        <View style={[styles.starBadge, { top: insets.top + 14 }]}>
          <Ionicons name="star" size={14} color={YELLOW} />
          <Text style={styles.starBadgeText}>{starCount}</Text>
        </View>

        <View style={styles.logoIcon}>
          <View style={styles.logoArrowWrap}>
            <View style={styles.logoArrowSquare} />
          </View>
          <View style={[styles.logoArrowWrap, { marginLeft: -7 }]}>
            <View style={styles.logoArrowSquare} />
          </View>
        </View>
        <Text style={styles.partyName}>VALLENTUNA</Text>
        <Text style={styles.partySlogan}>Framåt</Text>
        <Text style={styles.heroSub}>mot en fri och rättvis demokrati</Text>
      </View>

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={handleSaved}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
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
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: BLUE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoArrowWrap: {
    width: 21,
    height: 40,
    overflow: "hidden",
  },
  logoArrowSquare: {
    width: 28,
    height: 28,
    backgroundColor: YELLOW,
    borderRadius: 5,
    position: "absolute",
    left: -14,
    top: 6,
    transform: [{ rotate: "45deg" }],
  },
  partyName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 4,
  },
  partySlogan: {
    color: YELLOW,
    fontSize: 24,
    fontWeight: "600",
    marginTop: -2,
    marginBottom: 12,
  },
  heroSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  valueCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.85)",
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
  valueTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: BLUE,
    marginBottom: 4,
  },
  valueBody: { fontSize: 15, color: "#555", lineHeight: 21 },

  aboutBox: {
    margin: 16,
    marginTop: 8,
    backgroundColor: "rgba(0,45,117,0.88)",
    borderRadius: 12,
    padding: 20,
  },
  aboutTitle: {
    color: YELLOW,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  aboutBody: { color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 22 },

  memberBox: {
    margin: 16,
    marginTop: 0,
    backgroundColor: "rgba(255,255,255,0.85)",
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
