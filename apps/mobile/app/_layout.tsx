import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { isAuthenticated } from "@/lib/auth";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    isAuthenticated().then((authed) => {
      const inAuth = segments[0] === "(auth)";
      if (!authed && !inAuth) {
        router.replace("/(auth)/login");
      } else if (authed && inAuth) {
        router.replace("/(app)/home");
      }
      setChecked(true);
    });
  }, [segments]);

  if (!checked) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
