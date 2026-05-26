import * as Notifications from "expo-notifications";
import { apiClient } from "../../lib/api";
import { Platform } from "react-native";
import { useRef, useState, useEffect } from "react";
import { View, PanResponder, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, usePathname, useRouter, Redirect } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import XAIModal from "../../lib/XAIModal";
import InterestsModal from "../../lib/InterestsModal";
import { SettingsModal } from "../../lib/SettingsModal";
import {
  incrementLoginCount,
  getOnboardingState,
  markPromptShown,
} from "../../lib/onboarding";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TABS = [
  "/",
  "/sessions",
  "/vote",
  "/proposals",
  "/archive",
  "/membership",
];

function tabIcon(name: IoniconsName) {
  function Icon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return Icon;
}

function SwipeTabNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [showXAI, setShowXAI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  pathnameRef.current = pathname;
  routerRef.current = router;

  useEffect(() => {
    const screenMap: Record<string, string> = {
      vote: "/vote",
      sessions: "/sessions",
      proposals: "/proposals",
      archive: "/archive",
    };
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const screen = response.notification.request.content.data?.screen as
          | string
          | undefined;
        routerRef.current.navigate((screenMap[screen ?? ""] ?? "/") as any);
      },
    );
    return () => sub.remove();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
        Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 2.5,
      onPanResponderRelease: (_, { dx, vx }) => {
        const p = pathnameRef.current.replace(/^\/\([^)]*\)/, "") || "/";
        const idx = TABS.indexOf(p);
        if (idx === -1) return;
        if (dx > 50 || vx > 0.3) {
          const prev = (idx - 1 + TABS.length) % TABS.length;
          routerRef.current.navigate(TABS[prev] as any);
        } else if (dx < -50 || vx < -0.3) {
          const next = (idx + 1) % TABS.length;
          routerRef.current.navigate(TABS[next] as any);
        }
      },
    }),
  ).current;

  // Normalise pathname (strip route-group prefix)
  const normPath = pathname.replace(/^\/\([^)]*\)/, "") || "/";

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#002d75",
          tabBarInactiveTintColor: "#aaa",
          tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e8e8e8" },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Hem", tabBarIcon: tabIcon("home-outline") }}
        />
        <Tabs.Screen
          name="sessions"
          options={{
            title: "Sessioner",
            tabBarIcon: tabIcon("people-outline"),
          }}
        />
        <Tabs.Screen
          name="vote"
          options={{
            title: "Rösta",
            tabBarIcon: tabIcon("checkmark-circle-outline"),
          }}
        />
        <Tabs.Screen
          name="proposals"
          options={{ title: "Förslag", tabBarIcon: tabIcon("bulb-outline") }}
        />
        <Tabs.Screen
          name="archive"
          options={{ title: "Arkiv", tabBarIcon: tabIcon("archive-outline") }}
        />
        <Tabs.Screen
          name="membership"
          options={{
            title: "Info",
            tabBarIcon: tabIcon("information-circle-outline"),
          }}
        />
      </Tabs>

      {/* XAI floating button — top-left, hidden on Hem to avoid covering star badge */}
      {!showXAI && normPath !== "/" && (
        <TouchableOpacity
          style={[styles.xaiBtn, { top: insets.top + 10 }]}
          onPress={() => setShowXAI(true)}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Ionicons name="sparkles" size={18} color="#f5a623" />
        </TouchableOpacity>
      )}

      <XAIModal
        visible={showXAI}
        onClose={() => setShowXAI(false)}
        pathname={normPath}
      />

      {/* Gear button — top-right, visible only on Bli medlem tab */}
      {normPath === "/membership" && !showSettings && (
        <TouchableOpacity
          style={[styles.gearBtn, { top: insets.top + 10 }]}
          onPress={() => setShowSettings(true)}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
      )}

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </View>
  );
}

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  const [showInterests, setShowInterests] = useState(false);
  const startupDone = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!user || startupDone.current) return;
    startupDone.current = true;

    (async () => {
      // Push token registration — only works in a real EAS build, not Expo Go
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
          });
        }
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== "granted") {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status === "granted") {
          const { data: token } = await Notifications.getExpoPushTokenAsync();
          await apiClient("/api/mobile/push-token", {
            method: "POST",
            body: JSON.stringify({ token }),
          });
        }
      } catch {
        // Silently skip in Expo Go — requires a real EAS build with projectId
      }

      // Progressive onboarding
      const loginCount = await incrementLoginCount();
      const { promptShownCount, profileCompleted } = await getOnboardingState();
      const shouldPrompt =
        !profileCompleted &&
        (loginCount === 2 || (loginCount === 3 && promptShownCount < 2));

      if (shouldPrompt) {
        await markPromptShown();
        timerRef.current = setTimeout(() => setShowInterests(true), 30_000);
      }
    })();

    return () => clearTimeout(timerRef.current); // useEffect cleanup — cancels the 30s timer if user logs out
  }, [user]);

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return (
    <>
      <SwipeTabNavigator />
      <InterestsModal
        visible={showInterests}
        onClose={() => setShowInterests(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gearBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#002d75",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  xaiBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#002d75",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
});
