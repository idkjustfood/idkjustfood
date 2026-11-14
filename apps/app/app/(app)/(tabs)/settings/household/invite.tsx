import { Copy, Share2 } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
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
  const { household, isPending } = useHousehold()

  return (
    <Screen title="Invite someone" back="/settings/household" narrow>
      {isPending ? (
        <ActivityIndicator />
      ) : !household || !isOwner(household.role) ? (
        <ErrorState
          title="You can't invite people here"
          message={
            household
              ? `Only owners of ${household.name} can invite people.`
              : "Pick a household first, then invite people to it."
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
        title="Could not create an invite link"
        message={create.error.message}
        onRetry={() => mutate()}
      />
    )
  }

  const invite = create.data
  const link = invite ? inviteLink(invite) : ""
  const message = `Join our household "${household.name}" on idkjustfood: ${link}`

  return (
    <Card className="gap-4 p-4">
      <Text className="text-base text-foreground">
        Send this link to the person you want to invite. When they open it and
        accept, they join {household.name} and see its recipes and shopping
        lists.
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
          The link works once and expires {inDays(invite.expiresAt)}. You can
          cancel it on the household screen.
        </Text>
      )}
      {canShare && (
        <Button
          icon={Share2}
          label="Share link"
          disabled={!invite}
          onPress={() => shareText(message, "Household invite")}
        />
      )}
      <Button
        variant={canShare ? "outline" : "default"}
        icon={Copy}
        label={copied ? "Copied" : "Copy link"}
        disabled={!invite}
        onPress={async () => {
          await copyText(link)
          setCopied(true)
        }}
      />
    </Card>
  )
}
