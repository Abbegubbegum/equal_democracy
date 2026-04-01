import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../../lib/auth-context";

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {user?.name}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  welcome: { fontSize: 22, fontWeight: "700", color: "#1a1a2e" },
  email: { fontSize: 15, color: "#555" },
  logoutButton: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logoutText: { color: "#555", fontSize: 15 },
});
