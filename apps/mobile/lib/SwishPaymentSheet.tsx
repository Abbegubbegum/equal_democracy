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
  createMembershipPayment,
  openSwishApp,
  watchPayment,
  type PaymentStatusResponse,
} from "./swish";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

type Phase = "creating" | "awaiting" | "failed";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called once the payment is confirmed PAID. */
  onPaid: (paidUntil: string | null) => void;
}

export default function SwishPaymentSheet({ visible, onClose, onPaid }: Props) {
  const [phase, setPhase] = useState<Phase>("creating");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Comes back from the server with the payment request, so the amount shown
  // always matches what Swish will actually charge — never a bundled constant.
  const [amount, setAmount] = useState<number | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    stopWatch.current?.();
    stopWatch.current = null;
  }, []);

  const handleStatus = useCallback(
    (res: PaymentStatusResponse) => {
      if (res.status === "CREATED") return;

      cleanup();
      if (res.status === "PAID") {
        onPaid(res.membership.paidUntil);
        return;
      }
      setError(res.message ?? "Betalningen genomfördes inte.");
      setPhase("failed");
    },
    [cleanup, onPaid],
  );

  const start = useCallback(async () => {
    setPhase("creating");
    setError(null);
    cleanup();

    try {
      const payment = await createMembershipPayment();
      setToken(payment.token);
      setAmount(payment.amount);
      setPhase("awaiting");

      // Watch before switching away — on a fast payment the result can be ready
      // by the time we come back, and the AppState listener needs to be live.
      stopWatch.current = watchPayment(payment.paymentId, {
        onStatus: handleStatus,
        onTimeout: () => {
          setError(
            "Vi fick inget svar från Swish. Kontrollera i Swish-appen om betalningen gick igenom innan du försöker igen.",
          );
          setPhase("failed");
        },
      });

      const opened = await openSwishApp(payment.token);
      if (!opened) {
        cleanup();
        setError(
          "Vi kunde inte öppna Swish. Är appen installerad på den här telefonen?",
        );
        setPhase("failed");
      }
    } catch (err: any) {
      setError(err?.message ?? "Betalningen kunde inte startas. Försök igen.");
      setPhase("failed");
    }
  }, [cleanup, handleStatus]);

  useEffect(() => {
    if (visible) start();
    else cleanup();
    return cleanup;
    // Intentionally keyed on `visible` alone. `start` depends on the parent's
    // onPaid callback, which is a new function on every render — including it
    // here would re-run this effect each render and create a fresh payment
    // request every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    cleanup();
    onClose();
  };

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

          {phase === "creating" && (
            <View style={styles.body}>
              <ActivityIndicator size="large" color={YELLOW} />
              <Text style={styles.title}>Startar betalning…</Text>
            </View>
          )}

          {phase === "awaiting" && (
            <View style={styles.body}>
              <ActivityIndicator size="large" color={YELLOW} />
              <Text style={styles.title}>Slutför i Swish</Text>
              <Text style={styles.text}>
                Godkänn betalningen{amount !== null ? ` på ${amount} kr` : ""}{" "}
                med BankID i Swish-appen. Du kommer tillbaka hit automatiskt.
              </Text>

              {token && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => openSwishApp(token)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="open-outline" size={18} color="#fff" />
                  <Text style={styles.secondaryBtnText}>Öppna Swish igen</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={close} activeOpacity={0.7}>
                <Text style={styles.cancel}>Avbryt</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === "failed" && (
            <View style={styles.body}>
              <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
              <Text style={styles.title}>Betalningen gick inte igenom</Text>
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
    backgroundColor: BLUE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  body: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
    gap: 14,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  text: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: YELLOW,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 6,
  },
  primaryBtnText: { color: BLUE, fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    marginTop: 6,
  },
  secondaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cancel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    paddingVertical: 6,
  },
});
