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
import { peekPendingInvite } from "@/lib/pending-invite"
import { useAuthConfig, type SocialProvider } from "@/lib/use-auth-config"

export default function Register() {
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
        setError(readableAuthError(error, "Could not create the account."))
    } catch (e) {
      setError(readableAuthError(e as Error, "Could not create the account."))
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
      if (error) setError(readableAuthError(error, "Could not sign up."))
    } catch (e) {
      setError(readableAuthError(e as Error, "Could not sign up."))
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
            {closed ? "Registration is closed" : "Create account"}
          </Text>
          {closed && (
            <Text className="text-base text-muted-foreground">
              {config.signupMode === "invite"
                ? "New accounts need an invite link. Ask a member of the household to send you one, then open it."
                : "This server isn't taking new accounts. Ask the person who runs it for access."}
            </Text>
          )}
          {!closed && (
            <>
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                autoComplete="name"
                textContentType="name"
              />
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
                label={busy ? "Creating account…" : "Create account"}
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
            <Text className="text-muted-foreground">Have an account?</Text>
            <Link href="/" className="font-medium text-primary">
              Log in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
