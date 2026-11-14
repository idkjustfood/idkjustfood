import { router, useLocalSearchParams } from "expo-router"
import { Check, House, LinkIcon, X } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { ApiError } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { authClient } from "@/lib/auth-client"
import { useAnswerInvite, useInvitePreview } from "@/lib/households"
import { setPendingInvite } from "@/lib/pending-invite"

/**
 * Where an invite link lands: <app>/invite/<id> on the web, or
 * idkjustfood://invite/<id> in the app. Shows who invited you to which
 * household, and lets you accept or decline.
 */
export default function InviteScreen() {
  const { t } = useTranslation("auth")
  const { id = "" } = useLocalSearchParams<{ id: string }>()
  const { data: session } = authClient.useSession()
  const { demo, setDemo } = useAppState()
  const signedIn = !!session && !demo

  return (
    <Screen title={t("invite.screenTitle")} narrow>
      {signedIn ? (
        <Answer inviteId={id} />
      ) : (
        <EmptyState
          icon={House}
          title={t("invite.invitedTitle")}
          message={t("invite.invitedMessage")}
          action={t("invite.loginOrRegister")}
          onAction={() => {
            setPendingInvite(id)
            setDemo(false)
            router.replace({ pathname: "/", params: {} })
          }}
        />
      )}
    </Screen>
  )
}

function Answer({ inviteId }: { inviteId: string }) {
  const { t } = useTranslation("auth")
  const preview = useInvitePreview(inviteId, true)
  const { accept, decline } = useAnswerInvite(inviteId)
  const [declined, setDeclined] = useState(false)
  const goHome = () => router.replace("/")

  if (declined) {
    return (
      <EmptyState
        icon={X}
        title={t("invite.declinedTitle")}
        message={t("invite.declinedMessage")}
        action={t("invite.goToRecipes")}
        onAction={goHome}
      />
    )
  }

  if (preview.isPending) {
    return (
      <View className="flex-row items-center gap-2" aria-busy>
        <ActivityIndicator />
        <Text className="text-muted-foreground">{t("invite.loading")}</Text>
      </View>
    )
  }

  if (preview.isError) {
    return (
      <EmptyState
        icon={LinkIcon}
        title={t("invite.brokenTitle")}
        message={
          preview.error instanceof ApiError && preview.error.status === 404
            ? t("invite.brokenNotFound")
            : preview.error.message
        }
        action={t("invite.goToRecipes")}
        onAction={goHome}
      />
    )
  }

  const invite = preview.data
  if (invite.alreadyMember) {
    return (
      <EmptyState
        icon={House}
        title={t("invite.alreadyTitle", { household: invite.householdName })}
        message={t("invite.alreadyMessage")}
        action={t("invite.openHousehold")}
        onAction={() => router.replace("/settings/household")}
      />
    )
  }

  const busy = accept.isPending || decline.isPending
  const error = accept.error ?? decline.error

  return (
    <Card className="gap-4 p-5">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon as={House} size={26} className="text-foreground" />
      </View>
      <Text role="heading" className="text-xl font-semibold text-foreground">
        {t("invite.joinTitle", {
          inviter: invite.inviterName,
          household: invite.householdName,
        })}
      </Text>
      <Text className="text-base text-muted-foreground">
        {t("invite.joinMessage")}
      </Text>
      {error && (
        <Text role="alert" className="text-sm text-destructive">
          {error.message}
        </Text>
      )}
      <Button
        icon={Check}
        label={accept.isPending ? t("invite.joining") : t("invite.join")}
        disabled={busy}
        onPress={() =>
          accept.mutate(undefined, {
            onSuccess: () => router.replace("/settings/household"),
          })
        }
      />
      <Button
        variant="ghost"
        label={decline.isPending ? t("invite.declining") : t("invite.decline")}
        disabled={busy}
        onPress={() =>
          decline.mutate(undefined, { onSuccess: () => setDeclined(true) })
        }
      />
    </Card>
  )
}
