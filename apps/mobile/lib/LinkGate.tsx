import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "./auth-context";
import {
  cancelBankIdLogin,
  dismissHostedLogin,
  openHostedLogin,
  startBankIdLogin,
  watchBankIdLogin,
} from "./bankid-login";

/**
 * Blocks a legacy email account until it connects BankID.
 *
 * These are the users who were already signed in when BankID login shipped —
 * most of the active ones, since a refresh token lasts 30 days. Their account
 * still works, but it cannot act.
 *
 * It blocks the **account**, not the app: "Fortsätt utan konto" logs out to
 * anonymous browsing, which is why anonymous browsing exists. An account must
 * never become a trap.
 *
 * Keyed on `capability === "needs_bankid"`, never on "is there a user" — a
 * BankID user who is merely ineligible has nothing to link, and showing them
 * this would be a dead end. That distinction is the reason `needs_bankid` is
 * its own state rather than a flavour of `restricted`.
 */

const BLUE = "#002d75";
const AMBER = "#f5a623";

export function LinkGate() {
  const { capability, refresh, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      stopRef.current?.();
      if (tokenRef.current) cancelBankIdLogin(tokenRef.current);
    },
    [],
  );

  async function link() {
    setError(null);
    setBusy(true);
    try {
      const started = await startBankIdLogin("link");
      tokenRef.current = started.pollToken;

      stopRef.current = watchBankIdLogin(started.pollToken, {
        onState: async (state) => {
          if (state.status === "VERIFIED") {
            tokenRef.current = null;
            dismissHostedLogin();
            // The account changed underneath us — re-read it rather than
            // assuming, and the gate closes on its own when capability moves.
            await refresh();
            setBusy(false);
            return;
          }
          if (state.status === "PENDING") return;
          tokenRef.current = null;
          setBusy(false);
          setError(state.message || "BankID kunde inte kopplas.");
        },
        onTimeout: () => {
          tokenRef.current = null;
          setBusy(false);
          setError("Det tog för lång tid. Försök igen.");
        },
      });

      await openHostedLogin(started.redirectUrl);
    } catch (err) {
      setBusy(false);
      setError((err as Error).message);
    }
  }

  if (capability !== "needs_bankid") return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Koppla ditt BankID</Text>
          <Text style={styles.body}>
            Vi har gått över till BankID. Koppla ditt BankID till kontot så
            behåller du dina förslag, röster och ditt medlemskap. Utan BankID
            kan du fortfarande läsa allt i appen, men inte rösta eller
            kommentera.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primary, busy && styles.disabled]}
            onPress={link}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={BLUE} />
            ) : (
              <Text style={styles.primaryText}>Koppla BankID</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={logout} disabled={busy}>
            <Text style={styles.secondaryText}>Fortsätt utan konto</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,20,60,0.85)",
    justifyContent: "center",
    padding: 24,
  },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: "800", color: BLUE },
  body: { fontSize: 14, lineHeight: 21, color: "#444" },
  error: {
    fontSize: 13,
    color: "#b91c1c",
    backgroundColor: "#fef2f2",
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
    textDecorationLine: "underline",
    paddingVertical: 6,
  },
});
