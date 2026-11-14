import { Link } from "expo-router"
import { useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import { SocialButtons } from "@/components/social-buttons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppState } from "@/lib/app-state"
import { authClient } from "@/lib/auth-client"
import { readableAuthError, validateCredentials } from "@/lib/auth-errors"
import type { SocialProvider } from "@/lib/use-auth-config"

export default function Login() {
  const { t } = useTranslation("auth")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { setDemo } = useAppState()

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
      if (error) setError(readableAuthError(error, t("login.failed")))
    } catch (e) {
      setError(readableAuthError(e as Error, t("login.failed")))
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
      if (error) setError(readableAuthError(error, t("login.failed")))
    } catch (e) {
      setError(readableAuthError(e as Error, t("login.failed")))
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="w-full max-w-md flex-grow justify-center gap-5 self-center p-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-semibold text-foreground">{t("login.title")}</Text>
          <Input
            label={t("fields.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Input
            label={t("fields.password")}
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
            label={busy ? t("login.busy") : t("login.submit")}
            disabled={busy}
            className="h-12"
            onPress={submit}
          />
          <SocialButtons onPress={social} disabled={busy} />
          <View className="flex-row justify-center gap-1">
            <Text className="text-muted-foreground">{t("login.noAccount")}</Text>
            <Link href="/register" className="font-medium text-primary">
              {t("login.register")}
            </Link>
          </View>
          <Button
            variant="ghost"
            label={t("login.demo")}
            onPress={() => setDemo(true)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
