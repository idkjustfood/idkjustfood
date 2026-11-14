import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { readableAuthError } from "@/lib/auth-errors"
import {
  isWrongCurrentPassword,
  validatePasswordChange,
} from "@/lib/password-change"

/** Lets a signed-in person set a new password. No email is involved. */
export default function ChangePassword() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setDone(false)
    const problem = validatePasswordChange({ current, next, repeat })
    if (problem) return setError(t(`settings:password.problem.${problem}`))
    setError(null)
    setBusy(true)
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
      })
      if (error) {
        setError(
          isWrongCurrentPassword(error)
            ? t("settings:password.problem.wrongCurrent")
            : readableAuthError(error, t("settings:password.failed"))
        )
        return
      }
      setCurrent("")
      setNext("")
      setRepeat("")
      setDone(true)
    } catch (e) {
      setError(readableAuthError(e as Error, t("settings:password.failed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t("settings:password.title")} back="/settings" narrow>
      <View className="gap-5">
        <Input
          label={t("settings:password.current")}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
        />
        <Input
          label={t("settings:password.new")}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Input
          label={t("settings:password.repeat")}
          value={repeat}
          onChangeText={setRepeat}
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
        {done && (
          <Text role="status" className="text-sm text-foreground">
            {t("settings:password.success")}
          </Text>
        )}
        <Button
          label={busy ? t("settings:password.busy") : t("settings:password.submit")}
          disabled={busy}
          className="h-12"
          onPress={submit}
        />
      </View>
    </Screen>
  )
}
