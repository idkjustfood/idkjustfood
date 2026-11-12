import { Link } from "expo-router"
import { useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { SocialButtons } from "@/components/social-buttons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { readableAuthError, validateCredentials } from "@/lib/auth-errors"
import type { SocialProvider } from "@/lib/use-auth-config"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    const problem = validateCredentials({ email, password })
    if (problem) return setError(problem)
    setError(null)
    setBusy(true)
    try {
      // On success the session is set and the route guard moves us into the app.
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      })
      if (error) setError(readableAuthError(error, "Could not log in."))
    } catch (e) {
      setError(readableAuthError(e as Error, "Could not log in."))
    } finally {
      setBusy(false)
    }
  }

  async function social(provider: SocialProvider) {
    setError(null)
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/",
      })
      if (error) setError(readableAuthError(error, "Could not log in."))
    } catch (e) {
      setError(readableAuthError(e as Error, "Could not log in."))
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-5 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-semibold text-foreground">Log in</Text>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
          />
          {error && (
            <Text role="alert" className="text-sm text-destructive">
              {error}
            </Text>
          )}
          <Button
            label={busy ? "Logging in…" : "Log in"}
            disabled={busy}
            className="h-12"
            onPress={submit}
          />
          <SocialButtons onPress={social} disabled={busy} />
          <View className="flex-row justify-center gap-1">
            <Text className="text-muted-foreground">No account yet?</Text>
            <Link href="/register" className="font-medium text-primary">
              Register
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
