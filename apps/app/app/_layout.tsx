import "../global.css"
import { Stack, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"

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

  // Wait for the stored session before choosing a screen, so a signed-in
  // person does not see the login screen flash by.
  if (isPending) return null

  // The demo shows the app with sample data, without an account or a running API.
  const signedIn = !!session || demo

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  )
}
