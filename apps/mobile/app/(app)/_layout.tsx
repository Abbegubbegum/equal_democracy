import { useRef, useState, useEffect } from "react";
import { View, PanResponder, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, usePathname, useRouter, Redirect } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import XAIModal from "../../lib/XAIModal";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TABS = ["/", "/sessions", "/vote", "/proposals", "/archive"];

function tabIcon(name: IoniconsName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

function SwipeTabNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [showXAI, setShowXAI] = useState(false);

  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  pathnameRef.current = pathname;
  routerRef.current = router;

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
    })
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
        <Tabs.Screen name="index"     options={{ title: "Hem",       tabBarIcon: tabIcon("home-outline") }} />
        <Tabs.Screen name="sessions"  options={{ title: "Sessioner", tabBarIcon: tabIcon("people-outline") }} />
        <Tabs.Screen name="vote"      options={{ title: "Rösta",     tabBarIcon: tabIcon("checkmark-circle-outline") }} />
        <Tabs.Screen name="proposals" options={{ title: "Förslag",   tabBarIcon: tabIcon("bulb-outline") }} />
        <Tabs.Screen name="archive"   options={{ title: "Arkiv",     tabBarIcon: tabIcon("archive-outline") }} />
      </Tabs>

      {/* XAI floating button — top-left, always visible on every tab */}
      {!showXAI && (
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
    </View>
  );
}

export default function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <SwipeTabNavigator />;
}

const styles = StyleSheet.create({
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
