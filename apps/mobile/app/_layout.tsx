import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0b1621" },
        headerTintColor: "#f4f8fb",
        contentStyle: { backgroundColor: "#081018" }
      }}
    />
  );
}

