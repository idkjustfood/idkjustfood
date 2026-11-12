import "../global.css"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { authClient } from "@/lib/auth-client"

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession()

  // Wait for the stored session before choosing a screen, so a signed-in
  // person does not see the login screen flash by.
  if (isPending) return null

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  )
}
