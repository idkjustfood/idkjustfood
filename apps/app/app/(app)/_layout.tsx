import { router, Stack } from "expo-router"
import { useEffect } from "react"

import { isCloud } from "@/lib/edition"
import { takePendingInvite } from "@/lib/pending-invite"
import { ShoppingProvider } from "@/lib/shopping"

export default function AppLayout() {
  // Someone opened an invite link, then logged in: take them back to it.
  useEffect(() => {
    const invite = takePendingInvite()
    if (invite) router.push(`/invite/${invite}`)
  }, [])

  return (
    <ShoppingProvider>
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
    </ShoppingProvider>
  )
}
