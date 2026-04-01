import { Stack } from "expo-router";
import { Redirect } from "expo-router";
import { useAuth } from "../../lib/auth-context";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect href="/(app)/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
