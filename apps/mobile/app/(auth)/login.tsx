import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../../lib/auth-context";
import { useRouter } from "expo-router";

const BLUE = "#002d75";
const DARK_BLUE = "#001c55";
const AMBER = "#f5a623";

type Step = "email" | "code";

function AppIcon({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path
        d="M 200,306 L 200,718 Q 200,768 241,739 L 519,541 Q 560,512 519,483 L 241,285 Q 200,256 200,306 Z"
        fill={AMBER}
      />
      <Path
        d="M 480,306 L 480,718 Q 480,768 521,739 L 799,541 Q 840,512 799,483 L 521,285 Q 480,256 480,306 Z"
        fill={AMBER}
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const { requestCode, login } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestCode() {
    setError(null);
    setLoading(true);
    try {
      await requestCode(email.trim().toLowerCase());
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), code.trim());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + title */}
        <View style={styles.logoRow}>
          <AppIcon size={64} />
          <View style={styles.titleBlock}>
            <Text style={styles.titleTop}>VALLENTUNA</Text>
            <Text style={styles.titleSub}>Framåt</Text>
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>
            {step === "email"
              ? "Ange din e-postadress för att få en inloggningskod"
              : `Koden skickades till ${email}`}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === "email" ? (
            <>
              <Text style={styles.label}>E-postadress</Text>
              <TextInput
                style={styles.input}
                placeholder="din@epost.se"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRequestCode}
                disabled={loading || !email.trim()}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={DARK_BLUE} />
                ) : (
                  <Text style={styles.buttonText}>Skicka kod</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Engångskod</Text>
              <TextInput
                style={[styles.input, styles.inputCode]}
                placeholder="••••••"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                editable={!loading}
              />
              <TouchableOpacity
                style={[
                  styles.button,
                  (loading || code.length < 6) && styles.buttonDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading || code.length < 6}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={DARK_BLUE} />
                ) : (
                  <Text style={styles.buttonText}>Logga in</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                <Text style={styles.linkText}>
                  Använd en annan e-postadress
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.legalText}>
          Genom att logga in godkänner du våra{"\n"}
          <Text
            style={styles.legalLink}
            onPress={() => router.push("/legal" as any)}
          >
            användarvillkor och integritetspolicy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BLUE },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 32,
  },
  titleBlock: { flexDirection: "column" },
  titleTop: {
    fontSize: 26,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 3,
    lineHeight: 28,
  },
  titleSub: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    marginTop: -2,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
    padding: 24,
    gap: 12,
    marginBottom: 20,
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  label: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: -4,
  },
  input: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
  inputCode: {
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 6,
  },
  button: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: DARK_BLUE, fontSize: 16, fontWeight: "800" },
  linkButton: { alignItems: "center", paddingVertical: 6 },
  linkText: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
  error: {
    color: "#fca5a5",
    textAlign: "center",
    fontSize: 14,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 8,
    padding: 10,
  },
  legalText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  legalLink: {
    color: AMBER,
    textDecorationLine: "underline",
  },
});
