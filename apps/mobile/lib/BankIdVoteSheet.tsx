import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  cancelVoteVerification,
  dismissHostedLogin,
  openHostedLogin,
  startVoteVerification,
  watchVerification,
  type VerificationState,
} from "./bankid";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

/**
 * `rejected` is kept apart from `failed` on purpose. A rejection is a verdict
 * about the voter — wrong kommun, under 16, already voted — and "Försök igen"
 * would be cruel and useless. A failure is something that might work next time.
 */
type Phase = "starting" | "awaiting" | "rejected" | "failed";

interface Props {
  visible: boolean;
  questionId: string;
  choice: "ja" | "nej";
  onClose: () => void;
  /** Called once the vote is signed and recorded. */
  onVerified: (state: VerificationState) => void;
}

export default function BankIdVoteSheet({
  visible,
  questionId,
  choice,
  onClose,
  onVerified,
}: Props) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const verificationId = useRef<string | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    stopWatch.current?.();
    stopWatch.current = null;
  }, []);

  const handleState = useCallback(
    (state: VerificationState) => {
      if (state.status === "PENDING") return;

      cleanup();
      // The signature is done either way — get the browser out of the way
      // before showing the outcome.
      dismissHostedLogin();

      if (state.status === "VERIFIED") {
        onVerified(state);
        return;
      }

      setError(state.message || "Rösten kunde inte registreras.");
      setPhase(state.status === "REJECTED" ? "rejected" : "failed");
    },
    [cleanup, onVerified],
  );

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    cleanup();

    try {
      const started = await startVoteVerification(questionId, choice);
      verificationId.current = started.verificationId;
      setRedirectUrl(started.redirectUrl);
      setPhase("awaiting");

      // Watch before opening the browser: on a fast signature the result can be
      // ready by the time we come back, and the AppState listener must be live.
      stopWatch.current = watchVerification(started.verificationId, {
        onState: handleState,
        onTimeout: () => {
          setError(
            "Vi fick inget svar från BankID. Kontrollera om signeringen gick igenom innan du försöker igen.",
          );
          setPhase("failed");
        },
      });

      const opened = await openHostedLogin(started.redirectUrl);
      if (!opened) {
        cleanup();
        setError("Vi kunde inte öppna BankID-sidan. Försök igen.");
        setPhase("failed");
      }
      // Deliberately nothing else here. openHostedLogin resolves when the
      // browser closes, which the user may do straight after signing — the
      // outcome comes from the poll, never from the browser.
    } catch (err: any) {
      setError(err?.message ?? "BankID kunde inte startas. Försök igen.");
      setPhase("failed");
    }
  }, [cleanup, handleState, questionId, choice]);

  useEffect(() => {
    if (visible) start();
    else cleanup();
    return cleanup;
    // Intentionally keyed on `visible` alone. `start` depends on the parent's
    // onVerified callback, which is a new function on every render — including
    // it here would re-run this effect each render and start a fresh BankID
    // order, which costs a signature every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** Closing while an order is live releases it, so the next attempt is not refused. */
  const close = () => {
    cleanup();
    if (phase === "awaiting" && verificationId.current) {
      cancelVoteVerification(verificationId.current);
    }
    verificationId.current = null;
    onClose();
  };

  const answer = choice === "ja" ? "JA" : "NEJ";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {phase === "starting" && (
            <View style={styles.body}>
              <ActivityIndicator size="large" color={YELLOW} />
              <Text style={styles.title}>Startar BankID…</Text>
            </View>
          )}

          {phase === "awaiting" && (
            <View style={styles.body}>
              <ActivityIndicator size="large" color={YELLOW} />
              <Text style={styles.title}>Signera din röst</Text>
              <Text style={styles.text}>
                Du röstar <Text style={styles.answer}>{answer}</Text>. Signera
                med BankID i webbläsaren som öppnades — texten du signerar är
                din röst. Du kommer tillbaka hit automatiskt.
              </Text>

              {/*
                No stall timer — the browser open is asynchronous and can fail
                or get lost (a dismissed tab, a slow Android intent chooser)
                without any signal we'd otherwise see, so the way back is
                offered the instant there is a redirectUrl to retry rather
                than after a wait.
              */}
              {redirectUrl && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => openHostedLogin(redirectUrl)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="open-outline" size={18} color="#fff" />
                  <Text style={styles.secondaryBtnText}>
                    Inte omdirigerad till BankID?
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={close} activeOpacity={0.7}>
                <Text style={styles.cancel}>Avbryt</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === "rejected" && (
            <View style={styles.body}>
              <Ionicons
                name="information-circle-outline"
                size={44}
                color={BLUE}
              />
              <Text style={styles.title}>Du kan inte rösta här</Text>
              <Text style={styles.text}>{error}</Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={close}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Jag förstår</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === "failed" && (
            <View style={styles.body}>
              <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
              <Text style={styles.title}>Signeringen gick inte igenom</Text>
              <Text style={styles.text}>{error}</Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={start}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Försök igen</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={close} activeOpacity={0.7}>
                <Text style={styles.cancel}>Stäng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 34,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginTop: 10,
    marginBottom: 6,
  },
  body: { alignItems: "center", paddingHorizontal: 26, paddingVertical: 22 },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: BLUE,
    marginTop: 14,
    textAlign: "center",
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4b5563",
    textAlign: "center",
    marginTop: 10,
  },
  answer: { fontWeight: "800", color: BLUE },
  primaryBtn: {
    backgroundColor: YELLOW,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 34,
    marginTop: 20,
  },
  primaryBtnText: { color: BLUE, fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginTop: 20,
  },
  secondaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancel: { color: "#6b7280", fontSize: 14, marginTop: 16, padding: 6 },
});
