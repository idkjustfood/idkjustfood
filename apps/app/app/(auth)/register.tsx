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
import { authClient } from "@/lib/auth-client"
import { readableAuthError, validateCredentials } from "@/lib/auth-errors"
import { peekPendingInvite } from "@/lib/pending-invite"
import { useAuthConfig, type SocialProvider } from "@/lib/use-auth-config"

export default function Register() {
  const { t } = useTranslation("auth")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const config = useAuthConfig()
  // An invite link opened before registering lets you in even when sign-up is closed.
  // Only `invite` mode honours it; elsewhere an invite can't create an account.
  const invite = config.signupMode === "invite" ? peekPendingInvite() : null
  const closed = !config.signupOpen && !invite

  async function submit() {
    const problem = validateCredentials({ name, email, password })
    if (problem) return setError(problem)
    setError(null)
    setBusy(true)
    try {
      // On success the session is set and the route guard moves us into the app.
      const { error } = await authClient.signUp.email(
        { name: name.trim(), email: email.trim(), password },
        invite ? { headers: { "x-invite-id": invite } } : undefined
      )
      if (error)
        setError(readableAuthError(error, t("register.failed")))
    } catch (e) {
      setError(readableAuthError(e as Error, t("register.failed")))
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
      if (error) setError(readableAuthError(error, t("register.socialFailed")))
    } catch (e) {
      setError(readableAuthError(e as Error, t("register.socialFailed")))
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
          <Text className="text-3xl font-semibold text-foreground">
            {closed ? t("register.closedTitle") : t("register.title")}
          </Text>
          {closed && (
            <Text className="text-base text-muted-foreground">
              {config.signupMode === "invite"
                ? t("register.closedInvite")
                : t("register.closedServer")}
            </Text>
          )}
          {!closed && (
            <>
              <Input
                label={t("fields.name")}
                value={name}
                onChangeText={setName}
                autoComplete="name"
                textContentType="name"
              />
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
                autoComplete="new-password"
                textContentType="newPassword"
                onSubmitEditing={submit}
              />
              {error && (
                <Text role="alert" className="text-sm text-destructive">
                  {error}
                </Text>
              )}
              <Button
                label={busy ? t("register.busy") : t("register.submit")}
                disabled={busy}
                className="h-12"
                onPress={submit}
              />
              {config.signupMode !== "invite" && (
                <SocialButtons onPress={social} disabled={busy} />
              )}
            </>
          )}
          <View className="flex-row justify-center gap-1">
            <Text className="text-muted-foreground">{t("register.haveAccount")}</Text>
            <Link href="/" className="font-medium text-primary">
              {t("register.login")}
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
