import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { markClaimPromptPending } from "../../lib/onboarding";
import {
  cancelBankIdLogin,
  dismissHostedLogin,
  openHostedLogin,
  startBankIdLogin,
  watchBankIdLogin,
} from "../../lib/bankid-login";

/**
 * BankID is the only way in.
 *
 * The email/OTP form that used to live here is gone. It could not lead anywhere
 * different — someone without BankID loses account access either way, and
 * someone with it authenticates with BankID regardless — so it only added a
 * second door onto the same room, which read as a choice when it was not one.
 * The OTP endpoints stay alive for app builds that predate this screen
 * (docs/bankid-login-plan.md §7.4, §12 D3).
 *
 * This is now a pushed route rather than a wall: the app is fully browsable
 * signed out, so "Fortsätt utan konto" is a real option and not a consolation.
 */

const BLUE = "#002d75";
const DARK_BLUE = "#001c55";
const AMBER = "#f5a623";

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

type Phase = "idle" | "starting" | "awaiting";

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithTokens } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // State rather than a ref: it is read during render, and a ref read there
  // would not re-render when it changes. BankIdVoteSheet holds it the same way.
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      // Stop polling, but **do not cancel the order**.
      //
      // Cancelling here killed live BankID orders: opening the hosted page
      // backgrounds the app, and any remount in that window ran this cleanup
      // while the user was still signing. The log for one such attempt showed a
      // DELETE thirteen seconds in, long before anyone could have finished.
      //
      // An abandoned order expires on its own in about three minutes, which is
      // a far smaller cost than destroying one the user is actively completing.
      // Explicit cancellation is a button, not a lifecycle event.
      stopRef.current?.();
    },
    [],
  );

  async function start() {
    setError(null);
    setNotice(null);
    setPhase("starting");

    try {
      const started = await startBankIdLogin("login");
      tokenRef.current = started.pollToken;
      setRedirectUrl(started.redirectUrl);
      setPhase("awaiting");

      stopRef.current = watchBankIdLogin(started.pollToken, {
        onState: async (state) => {
          if (state.status === "VERIFIED" && state.accessToken) {
            tokenRef.current = null;
            dismissHostedLogin();

            // Written *before* the session lands. signInWithTokens sets the
            // user, which is what wakes the tab layout — and the layout reads
            // this flag. Writing it afterwards let the read win the race, and
            // the prompt never appeared.
            if (state.createdAccount) await markClaimPromptPending();

            await signInWithTokens(
              state.accessToken,
              state.refreshToken!,
              state.user!,
            );

            // An ineligible person is genuinely signed in — they just may not
            // act here. Telling them now beats letting them discover it at
            // their first tap on a vote button.
            if (state.capability !== "participant" && state.capabilityMessage) {
              setPhase("idle");
              setNotice(state.capabilityMessage);
              return;
            }
            router.replace("/(app)");
            return;
          }

          if (state.status === "ALREADY_CONSUMED") {
            // The first poll already took the tokens. Nothing is wrong.
            tokenRef.current = null;
            setPhase("idle");
            return;
          }

          if (state.status === "PENDING") return;

          tokenRef.current = null;
          setPhase("idle");
          setError(state.message || "Inloggningen kunde inte slutföras.");
        },
        onTimeout: () => {
          tokenRef.current = null;
          setPhase("idle");
          setError("Inloggningen tog för lång tid. Försök igen.");
        },
      });

      await openHostedLogin(started.redirectUrl);
    } catch (err) {
      setPhase("idle");
      setError((err as Error).message);
    }
  }

  const busy = phase !== "idle";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoRow}>
          <AppIcon />
          <View>
            <Text style={styles.wordmark}>VALLENTUNA</Text>
            <Text style={styles.wordmarkSub}>Framåt</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitle}>
            Logga in med BankID för att rösta, kommentera och lämna förslag.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice && !error ? (
            <Text style={styles.notice}>{notice}</Text>
          ) : null}

          {/*
            No stall timer — the browser open is asynchronous and can fail or
            get lost (a dismissed tab, a slow Android intent chooser) without
            any signal we'd otherwise see, so the way back is offered the
            instant there is a redirectUrl to retry rather than after a wait.
          */}
          {busy && redirectUrl ? (
            <TouchableOpacity
              onPress={() => openHostedLogin(redirectUrl)}
              activeOpacity={0.7}
            >
              <Text style={styles.retryLink}>
                Inte omdirigerad till BankID?
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={start}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={DARK_BLUE} />
            ) : (
              <Text style={styles.buttonText}>Logga in med BankID</Text>
            )}
          </TouchableOpacity>

          {busy ? (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                // The one place cancelling is right: the user said so.
                stopRef.current?.();
                if (tokenRef.current) cancelBankIdLogin(tokenRef.current);
                tokenRef.current = null;
                setPhase("idle");
              }}
            >
              <Text style={styles.linkText}>Avbryt</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.replace("/(app)")}
            >
              <Text style={styles.linkText}>
                Fortsätt utan konto — du kan läsa allt ändå
              </Text>
            </TouchableOpacity>
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
    </View>
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
  wordmark: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 3,
  },
  wordmarkSub: { color: "#fff", fontSize: 17, marginTop: -2 },
  card: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    gap: 18,
  },
  subtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
  },
  error: {
    color: "#fca5a5",
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
  },
  retryLink: {
    color: AMBER,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  notice: {
    color: "#fde68a",
    backgroundColor: "rgba(245,166,35,0.15)",
    borderColor: "rgba(245,166,35,0.35)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
  },
  button: {
    backgroundColor: AMBER,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: DARK_BLUE, fontSize: 17, fontWeight: "800" },
  linkButton: { paddingVertical: 4 },
  linkText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textAlign: "center",
  },
  legalText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 28,
    lineHeight: 18,
  },
  legalLink: { textDecorationLine: "underline" },
});
