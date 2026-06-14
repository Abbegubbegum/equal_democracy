import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useRouter } from "expo-router";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

// QR-koden i appen pekar på en sida vi själva styr (apps/web/pages/app.tsx).
// Den sidan vidarebefordrar Android → Google Play och iOS → App Store, så vi
// kan ändra var nedladdningen hamnar utan att bygga om appen.
const APP_URL = "https://www.vallentuna.app/app";

const BENEFITS = [
  "Utökad rösträtt till en röst varje månad",
  "Möjlighet att själv bli arvoderad kandidat",
  "Utveckla partiets verksamhet och teknik",
  "Inbjudan till exklusiva möten och fester",
];

export default function MembershipScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showQR, setShowQR] = React.useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bli medlem</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Ionicons name="people" size={40} color={YELLOW} />
          <Text style={styles.heroTitle}>Vallentuna Framåt</Text>
          <Text style={styles.heroSub}>Ditt lokala parti där du bestämmer</Text>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Regler</Text>
          <Text style={styles.rulesText}>
            Du kan rösta fritt fram till valet, debattera och lämna förslag.
            Skriv kortfattat och sakligt. XAI hjälper dig med formuleringarna.
            {"\n\n"}Efter valet är rösträtten begränsad, vilket gör rösterna
            mycket tyngre. Alla har då rätt att rösta i två frågor om året och
            lämna ett förslag.
          </Text>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Lokalt engagemang</Text>
          <Text style={styles.rulesText}>
            Appen förutsätter att du är folkbokförd i Vallentuna. Verifiering
            med BankID kommer snart.
          </Text>
        </View>

        <View style={styles.founderBanner}>
          <Ionicons name="gift-outline" size={20} color={YELLOW} />
          <Text style={styles.founderText}>
            <Text style={styles.founderBold}>Demokratipionjärer — </Text>
            Vi är några som vill förbättra demokratin i Vallentuna. Den måste
            bli bättre överallt, och någonstans ska man börja. Vi har inga
            mandat ännu, men vi bygger partiet tillsammans. Vill du bli medlem?
            Som tack täcker din avgift även 2027. Du betalar en gång, du är med
            i två år.
          </Text>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Medlemsavgift</Text>
          <Text style={styles.price}>
            250 kr <Text style={styles.pricePer}>/år</Text>
          </Text>
          <Text style={styles.priceYears}>Täcker 2026 och 2027</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Som medlem får du</Text>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.payBtn} activeOpacity={0.85} disabled>
          <Ionicons name="card-outline" size={20} color={BLUE} />
          <Text style={styles.payBtnText}>Betala med Swish</Text>
        </TouchableOpacity>
        <Text style={styles.comingSoon}>Betalning aktiveras snart</Text>

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => setShowQR(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
          <Text style={styles.shareBtnText}>Dela appen med en vän</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/legal" as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.legalLink}>
            Integritetspolicy & Användarvillkor
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showQR}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQR(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowQR(false)}>
          <View style={styles.qrBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.qrBox}>
                <Text style={styles.qrTitle}>Scanna för att ladda ner</Text>
                <View style={styles.qrCode}>
                  <QRCode value={APP_URL} size={200} color={BLUE} />
                </View>
                <Text style={styles.qrHint}>Vallentuna Framåt</Text>
                <TouchableOpacity
                  onPress={() => setShowQR(false)}
                  style={styles.qrClose}
                >
                  <Text style={styles.qrCloseText}>Stäng</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLUE },
  header: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },

  container: { padding: 16, gap: 16, paddingBottom: 48 },

  heroCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroSub: { color: "rgba(255,255,255,0.7)", fontSize: 15 },

  rulesCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  rulesTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rulesText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    lineHeight: 22,
  },

  priceCard: {
    backgroundColor: YELLOW,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  priceLabel: { color: BLUE, fontSize: 14, fontWeight: "600" },
  price: { color: BLUE, fontSize: 36, fontWeight: "900" },
  pricePer: { fontSize: 18, fontWeight: "500" },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  benefitText: { fontSize: 15, color: "#333", lineHeight: 22, flex: 1 },

  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    opacity: 0.5,
  },
  payBtnText: { color: BLUE, fontSize: 16, fontWeight: "800" },
  comingSoon: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    textAlign: "center",
    marginTop: -8,
  },

  priceYears: {
    color: BLUE,
    fontSize: 14,
    fontWeight: "700",
    opacity: 0.7,
    marginTop: 2,
  },

  founderBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(245,166,35,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.4)",
    borderRadius: 14,
    padding: 16,
  },
  founderText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  founderBold: { fontWeight: "800", color: "#fff" },

  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    marginTop: 4,
  },
  shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  qrBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  qrBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 16,
    marginHorizontal: 32,
  },
  qrTitle: { fontSize: 17, fontWeight: "800", color: BLUE },
  qrCode: { padding: 12, backgroundColor: "#fff", borderRadius: 8 },
  qrHint: { fontSize: 14, color: "#888" },
  qrClose: {
    backgroundColor: BLUE,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  qrCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  legalLink: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    textAlign: "center",
    textDecorationLine: "underline",
    paddingVertical: 8,
  },
});
