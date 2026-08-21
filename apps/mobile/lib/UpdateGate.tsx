import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  APP_VERSION,
  checkAppVersion,
  dismissUpdate,
  isUpdateDismissed,
  openStore,
  type VersionCheck,
} from "./version-check";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

// Re-checking on every foreground would also fire on the short app-switches the
// app makes itself (Swish, the store listing). Five minutes is often enough to
// catch a user who leaves the app open for days, rare enough to be invisible.
const MIN_RECHECK_MS = 5 * 60 * 1000;

/**
 * Blocks or nudges builds the server says are out of date.
 *
 * Mounted at the root, outside the auth guard: a build old enough to be blocked
 * may well be too old to sign in, and the wall has to come first either way.
 *
 * Two tiers, both decided server-side:
 *   • update-required  — undismissable wall, the app is unusable behind it
 *   • update-available — bottom sheet with "Senare", asked once per version
 */
export default function UpdateGate() {
  const [check, setCheck] = useState<VersionCheck | null>(null);
  const lastCheckedAt = useRef(0);

  const run = useCallback(async () => {
    lastCheckedAt.current = Date.now();

    const result = await checkAppVersion();
    // Fail open — a failed check leaves whatever verdict we already had.
    if (!result || result.status === "ok") return;

    if (
      result.status === "update-available" &&
      (await isUpdateDismissed(result.latest))
    ) {
      return;
    }

    setCheck(result);
  }, []);

  useEffect(() => {
    run();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active") return;
      if (Date.now() - lastCheckedAt.current < MIN_RECHECK_MS) return;
      run();
    });
    return () => sub.remove();
  }, [run]);

  const later = useCallback(async () => {
    if (check) await dismissUpdate(check.latest);
    setCheck(null);
  }, [check]);

  if (!check) return null;

  const forced = check.status === "update-required";
  const update = () => openStore(check.storeUrl);
  const versionLine = `Din version ${APP_VERSION} · senaste ${check.latest}`;

  if (forced) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => {}}>
        <View style={styles.wall}>
          <Ionicons name="cloud-download-outline" size={64} color={YELLOW} />
          <Text style={styles.wallTitle}>{check.title}</Text>
          <Text style={styles.text}>{check.message}</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={update}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {check.actionLabel ?? "Uppdatera"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.version}>{versionLine}</Text>

          {/* Dev builds run against whatever app.json says — without this a
              raised floor would lock the workstation out of its own app. */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={() => setCheck(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancel}>Fortsätt ändå (dev)</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={later}>
      <Pressable style={styles.backdrop} onPress={later} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.body}>
            <Ionicons name="sparkles-outline" size={40} color={YELLOW} />
            <Text style={styles.title}>{check.title}</Text>
            <Text style={styles.text}>{check.message}</Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={update}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {check.actionLabel ?? "Uppdatera"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={later} activeOpacity={0.7}>
              <Text style={styles.cancel}>Senare</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wall: {
    flex: 1,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  wallTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  version: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
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
  cancel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    paddingVertical: 6,
  },
});
