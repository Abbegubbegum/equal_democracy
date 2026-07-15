import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth-context";
import LoadingLoop from "../lib/LoadingLoop";

// While the session is being restored from storage, show the animated brand
// loop instead of a blank screen — it takes over from the (blue) native splash
// so the whole cold-start reads as one continuous animation.
function RootNavigator() {
  const { isLoading } = useAuth();
  if (isLoading) return <LoadingLoop />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
