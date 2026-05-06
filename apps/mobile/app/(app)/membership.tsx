import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

const BENEFITS = [
  "Utökad rösträtt till en röst varje månad",
  "Möjlighet att själv bli arvoderad kandidat",
  "Utveckla partiets verksamhet och teknik",
  "Inbjudan till exklusiva möten och fester",
];

export default function MembershipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bli medlem</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Ionicons name="people" size={40} color={YELLOW} />
          <Text style={styles.heroTitle}>Vallentuna Framåt</Text>
          <Text style={styles.heroSub}>Bli delägare i din kommun</Text>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Medlemsavgift</Text>
          <Text style={styles.price}>250 kr <Text style={styles.pricePer}>/år</Text></Text>
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

        <View style={styles.bankidNotice}>
          <Ionicons name="shield-checkmark-outline" size={20} color={BLUE} />
          <Text style={styles.bankidText}>
            Medlemskap kräver att du är folkbokförd i Vallentuna. Verifiering med BankID kommer snart.
          </Text>
        </View>

        <TouchableOpacity style={styles.payBtn} activeOpacity={0.85} disabled>
          <Ionicons name="card-outline" size={20} color={BLUE} />
          <Text style={styles.payBtnText}>Betala med Swish</Text>
        </TouchableOpacity>
        <Text style={styles.comingSoon}>Betalning aktiveras snart</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLUE },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  heroSub: { color: "rgba(255,255,255,0.7)", fontSize: 14 },

  priceCard: {
    backgroundColor: YELLOW,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  priceLabel: { color: BLUE, fontSize: 13, fontWeight: "600" },
  price: { color: BLUE, fontSize: 36, fontWeight: "900" },
  pricePer: { fontSize: 18, fontWeight: "500" },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#222", marginBottom: 4 },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  benefitText: { fontSize: 14, color: "#333", lineHeight: 20, flex: 1 },

  bankidNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 16,
  },
  bankidText: { color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 19, flex: 1 },

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
  comingSoon: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", marginTop: -8 },
});
