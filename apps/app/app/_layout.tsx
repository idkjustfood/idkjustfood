import "../global.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useMemo } from "react"

import { AppStateProvider, useAppState } from "@/lib/app-state"
import { authClient } from "@/lib/auth-client"
import { NAV_THEME, useAppearance } from "@/lib/theme"

export default function RootLayout() {
  return (
    <AppStateProvider>
      <Root />
    </AppStateProvider>
  )
}

function Root() {
  const { data: session, isPending } = authClient.useSession()
  const { demo, appearance } = useAppState()
  const scheme = useAppearance(appearance)
  const userId = session?.user.id

  // A fresh cache per account (and for the demo), so nobody ever sees data
  // loaded for the previous account.
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
    [userId, demo]
  )

  // Wait for the stored session before choosing a screen, so a signed-in
  // person does not see the login screen flash by.
  if (isPending) return null

  // The demo shows the app with sample data, without an account or a running API.
  const signedIn = !!session || demo

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NAV_THEME[scheme]}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          {/* Invite links open here whether or not someone is signed in. */}
          <Stack.Screen name="invite/[id]" />
        </Stack>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
