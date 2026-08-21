import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useFocusEffect, useRouter } from "expo-router";
import SwishPaymentSheet from "../../lib/SwishPaymentSheet";
import CelebrationModal from "../../lib/CelebrationModal";
import { getMembership, type Membership } from "../../lib/swish";
import { addStars } from "../../lib/stars";

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
    title: "MAJ",
    text: "MAJ är en AI-betjänt som hjälper dig att göra rätt, men det är du som bestämmer. Gör MAJ något konstigt så finns det en anmälningsknapp. Tryck så granskar vi den.\n\nVarje år lämnar MAJ en demokratirapport som mäter maktkoncentrationen i lokalpartiet. Vi vill inte ha någon mäktig ledare utan mäktiga medborgare.",
  },
];

/** Reward for joining — the same as submitting a citizen proposal. */
const MEMBERSHIP_STARS = 5;

/**
 * "2027-12-31T23:59:59.999Z" → "2027", for the member badge.
 *
 * Must read the year in UTC. The server stores the last covered instant as UTC
 * end-of-year, and Sweden is UTC+1/+2 — so getFullYear() would report 2028 for
 * a membership that runs through 2027.
 */
function paidUntilYear(paidUntil: string | null): string | null {
  if (!paidUntil) return null;
  const year = new Date(paidUntil).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : null;
}

export default function MembershipScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showQR, setShowQR] = React.useState(false);
  const [membership, setMembership] = React.useState<Membership | null>(null);
  const [showPayment, setShowPayment] = React.useState(false);
  const [celebrate, setCelebrate] = React.useState(false);

  // Read fresh on focus: membership can be granted while the app is open (the
  // payment sheet) or on another device, and the stored auth user never changes.
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      getMembership()
        .then((m) => active && setMembership(m))
        .catch(() => {
          /* leave the pay button visible — the server re-checks on POST */
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const isMember = membership?.status === "active";
  const memberUntil = paidUntilYear(membership?.paidUntil ?? null);

  const handlePaid = (paidUntil: string | null) => {
    setShowPayment(false);
    setMembership((prev) =>
      prev ? { ...prev, status: "active", paidUntil } : prev,
    );
    addStars(MEMBERSHIP_STARS);
    setCelebrate(true);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Info</Text>
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

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Regler</Text>
          <Text style={styles.rulesText}>
            Du kan rösta i fem frågor fram till valet, debattera och lämna ett
            förslag. Upprepa inte samma förslag. Skriv kortfattat och sakligt.
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

        {/*
          Fee and covered years come from the server, never from a constant
          bundled into the build. That is what lets the price be changed (e.g.
          from a 1 kr live test to the real 250 kr) by editing the API alone,
          with no new App Store / Play release.
        */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Medlemsavgift</Text>
          <Text style={styles.price}>
            {membership ? `${membership.feeSek} kr` : "…"}{" "}
            <Text style={styles.pricePer}>/år</Text>
          </Text>
          {membership && membership.years.length > 0 && (
            <Text style={styles.priceYears}>
              Täcker {membership.years.join(" och ")}
            </Text>
          )}
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

        {isMember ? (
          <View style={styles.memberBadge}>
            <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            <Text style={styles.memberBadgeText}>
              Du är medlem{memberUntil ? ` till och med ${memberUntil}` : ""}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.payBtn}
            activeOpacity={0.85}
            onPress={() => setShowPayment(true)}
          >
            <Ionicons name="card-outline" size={20} color={BLUE} />
            <Text style={styles.payBtnText}>Betala med Swish</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => setShowQR(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
          <Text style={styles.shareBtnText}>Dela appen med en vän</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.archiveBtn}
          onPress={() => router.push("/archive" as any)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="archive-outline"
            size={18}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={styles.archiveBtnText}>Visa arkiv</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/legal" as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.legalLink}>
            Integritetspolicy & Användarvillkor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            Linking.openURL("https://github.com/Abbegubbegum/equal_democracy")
          }
          activeOpacity={0.7}
        >
          <Text style={styles.legalLink}>
            Källkod (öppen källkod, AGPL-3.0)
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

      <SwishPaymentSheet
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onPaid={handlePaid}
      />

      <CelebrationModal
        visible={celebrate}
        title="Välkommen som medlem!"
        subtitle="Din avgift täcker både 2026 och 2027."
        stars={MEMBERSHIP_STARS}
        onDone={() => setCelebrate(false)}
      />
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

  valueCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: { flex: 1 },
  valueTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: YELLOW,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  valueBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
  },

  aboutBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
  },
  aboutTitle: {
    color: YELLOW,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  aboutBody: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    lineHeight: 22,
  },

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
  },
  payBtnText: { color: BLUE, fontSize: 16, fontWeight: "800" },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(22,163,74,0.15)",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.5)",
    paddingVertical: 16,
    borderRadius: 14,
  },
  memberBadgeText: { color: "#fff", fontSize: 16, fontWeight: "800" },

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

  archiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  archiveBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "600",
  },

  legalLink: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    textAlign: "center",
    textDecorationLine: "underline",
    paddingVertical: 8,
  },
});
