import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

function Section({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function H({ children }: { children: string }) {
  return <Text style={styles.h3}>{children}</Text>;
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

function Li({ children }: { children: string }) {
  return (
    <View style={styles.liRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.liText}>{children}</Text>
    </View>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.tableCell}>{label}</Text>
      <Text style={[styles.tableCell, styles.tableCellRight]}>{value}</Text>
    </View>
  );
}

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Juridisk information</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── INTEGRITETSPOLICY ── */}
        <Section title="Integritetspolicy" />
        <Text style={styles.updated}>Senast uppdaterad: 14 juni 2026</Text>

        <H>1. Personuppgiftsansvarig</H>
        <P>
          Vallentuna Framåt{"\n"}
          Org.nr: 802555-8852{"\n"}
          c/o Norbäck, Björkhagsvägen 75 D, 186 35 Vallentuna{"\n"}
          kontakt@vallentunaframat.se
        </P>

        <H>2. Vilka uppgifter vi samlar in</H>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>
              Uppgift
            </Text>
            <Text
              style={[
                styles.tableCell,
                styles.tableCellRight,
                styles.tableHeaderText,
              ]}
            >
              Syfte
            </Text>
          </View>
          <TableRow label="E-postadress" value="Inloggning via engångskod" />
          <TableRow label="Namn" value="Visning i appen" />
          <TableRow
            label="Röster och förslag"
            value="Demokratiskt deltagande"
          />
          <TableRow label="Intresseområden" value="Anpassa notiser" />
          <TableRow
            label="Push-notis-token"
            value="Aviseringar till din enhet"
          />
          <TableRow label="Telefonnummer" value="SMS-notiser (valfritt)" />
          <TableRow label="IP-adress" value="Säkerhet och felsökning" />
          <TableRow
            label="Anonym användningsstatistik"
            value="Förbättra appen – kan inte kopplas till dig"
          />
        </View>
        <P>
          Vi samlar <Text style={styles.bold}>inte</Text> in personnummer i
          nuläget. Efter valet, om vi får mandat, kommer BankID att krävas för
          att verifiera folkbokföring i Vallentuna.
        </P>

        <H>3. Rättslig grund</H>
        <P>
          Vi behandlar dina uppgifter med stöd av{" "}
          <Text style={styles.bold}>berättigat intresse</Text> (demokratiskt
          deltagande samt anonym användningsstatistik för att förbättra appen)
          och <Text style={styles.bold}>samtycke</Text> (push-notiser, SMS).
        </P>

        <H>4. Hur länge sparar vi uppgifterna</H>
        <P>
          Ditt konto sparas så länge du är aktiv användare. Du kan när som helst
          begära radering (se punkt 7).
        </P>

        <H>5. Tredjeparter vi delar data med</H>
        <Li>MongoDB Atlas — databaslagring</Li>
        <Li>Vercel — webbhotell och API</Li>
        <Li>Resend — utskick av inloggningskoder via e-post</Li>
        <Li>
          Expo — push-notiser (Expo Push API) samt anonym användningsstatistik
          (Expo Insights)
        </Li>
        <Li>Anthropic (Claude) — AI-moderering av kommentarer och förslag</Li>
        <Li>Twilio — SMS-notiser (om du valt det)</Li>

        <H>6. Överföring utanför EU/EES</H>
        <P>
          Flera leverantörer är amerikanska företag. Överföringen sker med stöd
          av EU:s standardavtalsklausuler (SCC).
        </P>

        <H>7. Dina rättigheter</H>
        <Li>Begära ut en kopia av dina uppgifter</Li>
        <Li>Begära rättelse av felaktiga uppgifter</Li>
        <Li>Begära radering av ditt konto</Li>
        <Li>Invända mot behandling</Li>
        <Li>Lämna klagomål till IMY (imy.se)</Li>
        <P>Kontakta oss: kontakt@vallentunaframat.se</P>

        {/* ── ANVÄNDARVILLKOR ── */}
        <View style={styles.divider} />
        <Section title="Användarvillkor" />
        <Text style={styles.updated}>Senast uppdaterad: 2 juni 2026</Text>

        <H>1. Om appen</H>
        <P>
          Vallentuna Framåt är en demokratiplattform där partiets medlemmar och
          sympatisörer fattar politiska beslut gemensamt via röstning, förslag
          och debatt.
        </P>

        <H>2. Vem får använda appen</H>
        <P>
          <Text style={styles.bold}>Fram till valet</Text> är appen öppen för
          alla svenska medborgare som vill pröva plattformen.
        </P>
        <P>
          <Text style={styles.bold}>Efter valet</Text>, om vi erhåller mandat,
          gäller för rösträtt:
        </P>
        <Li>Du måste vara folkbokförd i Vallentuna kommun</Li>
        <Li>Du måste vara minst 16 år</Li>
        <Li>Verifiering med BankID är obligatorisk</Li>

        <H>3. Demokratiska beslut och ansvar</H>
        <P>
          Vallentuna Framåt fattar sina politiska beslut genom röstning i appen.
          Röstresultaten är bindande — de som röstar via appen{" "}
          <Text style={styles.italic}>är</Text> Vallentuna Framåt.
        </P>
        <P>
          Vi ansvarar inte för tekniska avbrott som påverkar möjligheten att
          rösta. Vid tekniska problem kan omröstning hållas på nytt.
        </P>

        <H>4. Regler för innehåll</H>
        <P>
          Du ansvarar för allt innehåll du publicerar. Det är{" "}
          <Text style={styles.bold}>inte tillåtet</Text> att:
        </P>
        <Li>Hota, trakassera eller kränka andra användare</Li>
        <Li>Sprida falsk information</Li>
        <Li>Publicera olagligt material</Li>
        <Li>Använda appen i kommersiellt syfte</Li>
        <P>
          Vi förbehåller oss rätten att ta bort innehåll som bryter mot dessa
          regler.
        </P>

        <H>5. AI-moderering</H>
        <P>
          Kommentarer och förslag kan granskas automatiskt med AI (Anthropic
          Claude) för att identifiera olämpligt innehåll. AI-granskning ersätter
          inte mänsklig bedömning.
        </P>

        <H>6. Ändringar</H>
        <P>
          Vi kan uppdatera dessa villkor. Väsentliga ändringar meddelas via
          appen eller e-post.
        </P>

        <H>7. Kontakt</H>
        <P>
          kontakt@vallentunaframat.se{"\n"}
          Vallentuna Framåt, org.nr 802555-8852{"\n"}
          c/o Norbäck, Björkhagsvägen 75 D, 186 35 Vallentuna
        </P>
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
  container: { padding: 20, paddingBottom: 48 },

  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  updated: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 28,
  },

  h3: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 6,
  },
  p: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  bold: { fontWeight: "800", color: "#fff" },
  italic: { fontStyle: "italic" },

  liRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  liText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },

  table: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tableHeader: { backgroundColor: YELLOW },
  tableHeaderText: { color: BLUE, fontWeight: "700" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,45,117,0.12)",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  tableCell: {
    flex: 1,
    padding: 10,
    color: BLUE,
    fontSize: 12,
  },
  tableCellRight: {
    color: "#334e8a",
  },
});
