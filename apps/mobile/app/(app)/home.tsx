import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "@/lib/auth";

export default function HomeScreen() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Welcome</Text>

      <View style={styles.grid}>
        <NavCard title="Sessions" emoji="🗳️" onPress={() => {}} />
        <NavCard title="Proposals" emoji="💡" onPress={() => {}} />
        <NavCard title="Archive" emoji="📁" onPress={() => {}} />
        <NavCard title="Budget" emoji="💰" onPress={() => {}} />
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function NavCard({
  title,
  emoji,
  onPress,
}: {
  title: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 24, gap: 24 },
  heading: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#00236a",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1f2937" },
  signOut: { marginTop: 16, alignItems: "center" },
  signOutText: { color: "#6b7280", fontSize: 14 },
});
