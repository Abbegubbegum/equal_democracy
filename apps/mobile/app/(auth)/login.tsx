import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { requestLoginCode, verifyLoginCode } from "@/lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRequestCode() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await requestLoginCode(email.trim().toLowerCase());
      setStep("code");
    } catch (e: any) {
      setError(e.message || "Failed to send code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      await verifyLoginCode(email.trim().toLowerCase(), code.trim());
      router.replace("/(app)/home");
    } catch (e: any) {
      setError(e.message || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Equal Democracy</Text>
        <Text style={styles.subtitle}>
          {step === "email" ? "Enter your email to sign in" : `Code sent to ${email}`}
        </Text>

        {step === "email" ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRequestCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Login Code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("email")}>
              <Text style={styles.back}>Use a different email</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#00236a" },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#f8b60e",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#c0cce8",
    textAlign: "center",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#f8b60e",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#00236a", fontWeight: "700", fontSize: 16 },
  back: { color: "#c0cce8", textAlign: "center", marginTop: 4 },
  error: { color: "#f87171", textAlign: "center" },
});
