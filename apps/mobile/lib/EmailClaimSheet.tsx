import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { apiClient } from "./api";

/**
 * Claiming a legacy account by proving its email address.
 *
 * Two steps, one sheet: send a code to the address, then enter it. On success
 * the old account's votes, proposals and membership move onto this one.
 *
 * Used from the two places a claim can start, which differ only in wording:
 *
 *   `mode="prompt"`  the post-signup "did you already have an account?" ask,
 *                    where we do not yet know whether an old account exists
 *   `mode="merge"`   the settings field, after the plain setter answered
 *                    MERGE_AVAILABLE — here we know one does
 *
 * Verified, unlike simply typing an address into the settings field. That
 * asymmetry is deliberate: storing where to reach someone is harmless, but
 * moving an account's history and its paid membership must prove the mailbox,
 * or anyone could take over a legacy account by typing its owner's address.
 */

const BLUE = "#002d75";
const AMBER = "#f5a623";

export function EmailClaimSheet({
  visible,
  mode,
  initialEmail = "",
  onClose,
  onClaimed,
}: {
  visible: boolean;
  mode: "prompt" | "merge";
  initialEmail?: string;
  onClose: () => void;
  onClaimed: (merged: boolean) => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Re-seed whenever the sheet opens: the settings path hands in the address the
  // user just typed, and a second open must not show the previous attempt.
  const [seeded, setSeeded] = useState(false);
  if (visible && !seeded) {
    setSeeded(true);
    setStep("email");
    setEmail(initialEmail);
    setCode("");
    setError(null);
    setNotice(null);
  }
  if (!visible && seeded) setSeeded(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient<{ message: string }>(
        "/api/mobile/user/email/claim",
        {
          method: "POST",
          body: JSON.stringify({ action: "request", email: email.trim() }),
        },
      );
      setNotice(res.message);
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient<{ merged: boolean; message: string }>(
        "/api/mobile/user/email/claim",
        {
          method: "POST",
          body: JSON.stringify({ action: "confirm", code: code.trim() }),
        },
      );
      onClaimed(!!res.merged);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>
              {mode === "merge"
                ? "Slå ihop med ditt gamla konto"
                : "Hade du ett konto med e-post?"}
            </Text>
            <Text style={styles.body}>
              {mode === "merge"
                ? "Den e-postadressen tillhör ett äldre konto. Bekräfta att adressen är din, så flyttar vi över dina förslag, röster och ditt medlemskap hit."
                : "Om du använde appen innan BankID infördes kan vi flytta över dina förslag, röster och ditt medlemskap. Ange e-postadressen du använde då."}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice && !error ? (
              <Text style={styles.notice}>{notice}</Text>
            ) : null}

            {step === "email" ? (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="namn@exempel.se"
                placeholderTextColor="#aaa"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!busy}
                autoFocus
              />
            ) : (
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, ""));
                  setError(null);
                }}
                placeholder="••••••"
                placeholderTextColor="#ccc"
                keyboardType="number-pad"
                maxLength={6}
                editable={!busy}
                autoFocus
              />
            )}

            <TouchableOpacity
              style={[styles.primary, busy && styles.disabled]}
              onPress={step === "email" ? sendCode : confirm}
              disabled={
                busy || (step === "email" ? !email.trim() : code.length !== 6)
              }
            >
              {busy ? (
                <ActivityIndicator color={BLUE} />
              ) : (
                <Text style={styles.primaryText}>
                  {step === "email" ? "Skicka kod" : "Bekräfta"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} disabled={busy}>
              <Text style={styles.secondaryText}>
                {mode === "merge" ? "Avbryt" : "Hoppa över"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,20,60,0.85)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 16 },
  title: { fontSize: 19, fontWeight: "800", color: BLUE },
  body: { fontSize: 14, lineHeight: 21, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
  },
  codeInput: {
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
    color: "#b91c1c",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 12,
  },
  notice: {
    fontSize: 13,
    color: "#166534",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 12,
  },
  primary: {
    backgroundColor: AMBER,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryText: { fontSize: 16, fontWeight: "800", color: BLUE },
  disabled: { opacity: 0.5 },
  secondaryText: {
    textAlign: "center",
    fontSize: 13,
    color: "#777",
    paddingVertical: 4,
  },
});
