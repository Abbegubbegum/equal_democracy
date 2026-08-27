import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useRef, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { usePathname, useRouter, withLayoutContext } from "expo-router";
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationOptions,
  type MaterialTopTabNavigationEventMap,
} from "@react-navigation/material-top-tabs";
import type {
  ParamListBase,
  TabNavigationState,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import XAIModal from "../../lib/XAIModal";
import InterestsModal from "../../lib/InterestsModal";
import { SettingsModal } from "../../lib/SettingsModal";
import { LinkGate } from "../../lib/LinkGate";
import { selectQuestion } from "../../lib/selected-question";
import {
  incrementLoginCount,
  getOnboardingState,
  markPromptShown,
  takeClaimPrompt,
} from "../../lib/onboarding";
import { EmailClaimSheet } from "../../lib/EmailClaimSheet";

const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

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

const ACTIVE_COLOR = "#002d75";
const INACTIVE_COLOR = "#aaa";

// `data.screen` on a push payload → route to open when it's tapped
const NOTIFICATION_ROUTES: Record<string, string> = {
  vote: "/vote",
  sessions: "/sessions",
  proposals: "/proposals",
  archive: "/archive", // pushed as a standalone screen (not a tab)
};

const TAB_ICONS: Record<string, IoniconsName> = {
  index: "home-outline",
  vote: "checkmark-circle-outline",
  proposals: "bulb-outline",
  membership: "information-circle-outline",
};

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

type BottomBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, { options: MaterialTopTabNavigationOptions }>;
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
  bottomPad: number;
};

function BottomBar({
  state,
  descriptors,
  navigation,
  bottomPad,
}: BottomBarProps) {
  return (
    <View
      style={[styles.bar, { height: 56 + bottomPad, paddingBottom: bottomPad }]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;
        const icon = TAB_ICONS[route.name] ?? "ellipse-outline";
        const label =
          (descriptors[route.key]?.options.title as string | undefined) ??
          route.name;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.barItem}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name={icon} size={22} color={color} />
            <Text style={[styles.barLabel, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TabNavigator() {
  const router = useRouter();
  const { user } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [showXAI, setShowXAI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const bottomPad =
    Platform.OS === "android" ? Math.max(insets.bottom, 12) : insets.bottom;

  const routerRef = useRef(router);
  routerRef.current = router;

  // Deep link from a tapped push notification.
  //
  // useLastNotificationResponse() rather than addNotificationResponseReceivedListener():
  // the hook also returns the response the app was *launched* with, so a cold
  // start works even though this component mounts long after the tap — after
  // the session is restored from SecureStore and, if the user was logged out,
  // after they have signed in.
  const notificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!notificationResponse) return;
    const data = notificationResponse.notification.request.content.data as
      { screen?: string; questionId?: string } | undefined;

    (async () => {
      // Preselect the question the notification is about, so Rösta opens on it
      // directly instead of the "välj en fråga på Hem" empty state.
      if (data?.questionId) await selectQuestion(String(data.questionId));
      routerRef.current.navigate(
        (NOTIFICATION_ROUTES[data?.screen ?? ""] ?? "/") as any,
      );
      // Consume the response so a later remount (logout → login) can't replay it.
      Notifications.clearLastNotificationResponse();
    })();
  }, [notificationResponse]);

  // Normalise pathname (strip route-group prefix)
  const normPath = pathname.replace(/^\/\([^)]*\)/, "") || "/";

  return (
    <View style={{ flex: 1 }}>
      <MaterialTopTabs
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          animationEnabled: true,
          lazy: false,
        }}
        tabBar={(props) => <BottomBar {...props} bottomPad={bottomPad} />}
      >
        <MaterialTopTabs.Screen name="index" options={{ title: "Hem" }} />
        <MaterialTopTabs.Screen name="vote" options={{ title: "Rösta" }} />
        <MaterialTopTabs.Screen
          name="proposals"
          options={{ title: "Förslag" }}
        />
        <MaterialTopTabs.Screen name="membership" options={{ title: "Info" }} />
      </MaterialTopTabs>

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

      {/* Top-right on the Info tab. Settings when there is an account to
          configure; otherwise the way in — the sheet's contents (contact
          details, interests) all belong to an account, so offering it to a
          visitor would be a form that saves nothing. */}
      {normPath === "/membership" && !showSettings && (
        <TouchableOpacity
          style={[
            user ? styles.gearBtn : styles.loginPill,
            { top: insets.top + 10 },
          ]}
          onPress={() =>
            user ? setShowSettings(true) : router.push("/(auth)/login")
          }
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Ionicons
            name={user ? "settings-outline" : "log-in-outline"}
            size={20}
            color={user ? "rgba(255,255,255,0.85)" : "#002d75"}
          />
          {user ? null : <Text style={styles.loginPillText}>Logga in</Text>}
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
  const [showClaim, setShowClaim] = useState(false);
  const startupDone = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!user || startupDone.current) return;
    startupDone.current = true;

    (async () => {
      if (!IS_EXPO_GO) {
        try {
          if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("default", {
              name: "default",
              importance: Notifications.AndroidImportance.MAX,
            });
          }
          const { status: existing } =
            await Notifications.getPermissionsAsync();
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
          // Push registration failed — non-fatal
        }
      }

      // Right after BankID created the account, ask once whether they already
      // had one under an email. Before the interest prompt, and not on a timer:
      // it is about the account they just made, so it belongs to that moment
      // rather than 30 seconds into browsing.
      if (await takeClaimPrompt()) {
        setShowClaim(true);
        return;
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
  // No auth guard. The whole app is readable signed out; the actions inside it
  // gate themselves, and LinkGate handles the one account state that must not
  // be browsed in.
  return (
    <>
      <TabNavigator />
      <LinkGate />
      {/* Asked once, right after BankID created the account — see
          markClaimPromptPending. Skipping is a real answer; the same flow stays
          available from the settings sheet. */}
      <EmailClaimSheet
        visible={showClaim}
        mode="prompt"
        onClose={() => setShowClaim(false)}
        onClaimed={() => setShowClaim(false)}
      />
      <InterestsModal
        visible={showInterests}
        onClose={() => setShowInterests(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopColor: "#e8e8e8",
    borderTopWidth: 1,
    paddingTop: 6,
  },
  barItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  loginPill: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f5a623",
    justifyContent: "center",
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  loginPillText: { color: "#002d75", fontSize: 14, fontWeight: "800" },
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
