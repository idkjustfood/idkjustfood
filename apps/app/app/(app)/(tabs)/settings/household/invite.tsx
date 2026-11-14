import { Copy, Share2 } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  inviteLink,
  isOwner,
  useCreateInvite,
  useHousehold,
  type Household,
} from "@/lib/households"
import { canShare, copyText, inDays, shareText } from "@/lib/share"

export default function Invite() {
  const { t } = useTranslation()
  const { household, isPending } = useHousehold()

  return (
    <Screen title={t("settings:invite.title")} back="/settings/household" narrow>
      {isPending ? (
        <ActivityIndicator />
      ) : !household || !isOwner(household.role) ? (
        <ErrorState
          title={t("settings:invite.cantTitle")}
          message={
            household
              ? t("settings:invite.cantOwners", { name: household.name })
              : t("settings:invite.cantPick")
          }
        />
      ) : (
        <InviteLink household={household} />
      )}
    </Screen>
  )
}

/** Creates a fresh invite link when the screen opens and offers to copy or share it. */
function InviteLink({ household }: { household: Household }) {
  const { t } = useTranslation()
  const create = useCreateInvite(household.id)
  const [copied, setCopied] = useState(false)
  const { mutate } = create
  const started = useRef(false)

  // One new link per visit. The ref stops a second link when React runs effects twice.
  useEffect(() => {
    if (started.current) return
    started.current = true
    mutate()
  }, [mutate])

  if (create.isError) {
    return (
      <ErrorState
        title={t("settings:invite.createError")}
        message={create.error.message}
        onRetry={() => mutate()}
      />
    )
  }

  const invite = create.data
  const link = invite ? inviteLink(invite) : ""
  const message = t("settings:invite.message", {
    name: household.name,
    link,
  })

  return (
    <Card className="gap-4 p-4">
      <Text className="text-base text-foreground">
        {t("settings:invite.text", { name: household.name })}
      </Text>
      <View className="min-h-12 justify-center rounded-md bg-muted px-3 py-3">
        {invite ? (
          <Text selectable className="text-sm text-foreground">
            {link}
          </Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
      {invite && (
        <Text className="text-sm text-muted-foreground">
          {t("settings:invite.expires", { when: inDays(invite.expiresAt) })}
        </Text>
      )}
      {canShare && (
        <Button
          icon={Share2}
          label={t("settings:invite.share")}
          disabled={!invite}
          onPress={() => shareText(message, t("settings:invite.shareTitle"))}
        />
      )}
      <Button
        variant={canShare ? "outline" : "default"}
        icon={Copy}
        label={
          copied ? t("settings:invite.copied") : t("settings:invite.copy")
        }
        disabled={!invite}
        onPress={async () => {
          await copyText(link)
          setCopied(true)
        }}
      />
    </Card>
  )
}
