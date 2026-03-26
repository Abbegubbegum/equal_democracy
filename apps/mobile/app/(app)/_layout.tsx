import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#00236a" },
        headerTintColor: "#f8b60e",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    />
  );
}
