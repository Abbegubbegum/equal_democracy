import { Stack } from "expo-router";
import { Redirect } from "expo-router";
import { useAuth } from "../../lib/auth-context";

export default function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
