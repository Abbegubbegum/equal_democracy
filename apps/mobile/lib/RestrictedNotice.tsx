import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "./auth-context";

/**
 * What a gated action says when it refuses.
 *
 * One component for both reasons a person cannot act, because from the user's
 * side they are the same moment — a tap that did nothing — and only the wording
 * and the way out differ:
 *
 *   anonymous   → "log in with BankID", and a button that goes there
 *   restricted  → the folkbokföring reason, and no button, because signing in
 *                 again will not help
 *
 * `needs_bankid` never reaches this: the link gate has already blocked the
 * account at startup, so that user is choosing between linking and logging out
 * rather than tapping around the app.
 *
 * Use it through `useActionGate` rather than by hand — the point is that a
 * refusal is one line at the top of a handler, so nobody is tempted to skip it.
 */

const BLUE = "#002d75";
const AMBER = "#f5a623";

export function useActionGate() {
  const { capability, capabilityMessage } = useAuth();
  const [visible, setVisible] = useState(false);

  const canAct = capability === "participant";

  /**
   * Call at the top of any handler that writes:
   *
   *     if (!requireAct()) return;
   *
   * Returns true when the action may proceed; otherwise shows the notice and
   * returns false. It is a courtesy, not a security boundary — the server
   * refuses independently, and must keep doing so.
   */
  const requireAct = () => {
    if (canAct) return true;
    setVisible(true);
    return false;
  };

  const gate = (
    <RestrictedNotice
      visible={visible}
      onClose={() => setVisible(false)}
      capability={capability}
      message={capabilityMessage}
    />
  );

  return { canAct, requireAct, gate };
}

export function RestrictedNotice({
  visible,
  onClose,
  capability,
  message,
}: {
  visible: boolean;
  onClose: () => void;
  capability: string;
  message: string;
}) {
  const router = useRouter();
  const anonymous = capability === "anonymous";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {anonymous ? "Logga in för att delta" : "Du kan inte rösta här"}
          </Text>
          <Text style={styles.body}>
            {anonymous
              ? "Du kan läsa allt utan konto. För att rösta, kommentera, betygsätta eller lämna förslag behöver du logga in med BankID."
              : message ||
                "Ditt konto är verifierat men har inte rösträtt i Vallentuna."}
          </Text>

          {anonymous ? (
            <TouchableOpacity
              style={styles.primary}
              onPress={() => {
                onClose();
                router.push("/(auth)/login");
              }}
            >
              <Text style={styles.primaryText}>Logga in med BankID</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.secondaryText}>
              {anonymous ? "Inte nu" : "Jag förstår"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,20,60,0.8)",
    justifyContent: "center",
    padding: 24,
  },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, gap: 16 },
  title: { fontSize: 19, fontWeight: "800", color: BLUE },
  body: { fontSize: 14, lineHeight: 21, color: "#444" },
  primary: {
    backgroundColor: AMBER,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryText: { fontSize: 16, fontWeight: "800", color: BLUE },
  secondaryText: {
    textAlign: "center",
    fontSize: 13,
    color: "#777",
    paddingVertical: 4,
  },
});
