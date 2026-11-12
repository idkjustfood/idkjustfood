import { Stack } from "expo-router"

import { isCloud } from "@/lib/edition"

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Cooking mode covers the whole screen, without tab bar or side bar. */}
      <Stack.Screen
        name="cook/[id]"
        options={{ presentation: "fullScreenModal" }}
      />
      {/* Billing only exists in the cloud build. Self-hosted installs never show it. */}
      <Stack.Protected guard={isCloud}>
        <Stack.Screen name="billing" />
      </Stack.Protected>
    </Stack>
  )
}
