import { router, useLocalSearchParams } from "expo-router"
import { Check, House, LinkIcon, X } from "lucide-react-native"
import { useState } from "react"
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
  const { id = "" } = useLocalSearchParams<{ id: string }>()
  const { data: session } = authClient.useSession()
  const { demo, setDemo } = useAppState()
  const signedIn = !!session && !demo

  return (
    <Screen title="Household invite" narrow>
      {signedIn ? (
        <Answer inviteId={id} />
      ) : (
        <EmptyState
          icon={House}
          title="You're invited to a household"
          message="Log in or create an account to see the invite and join. You'll come back here afterwards."
          action="Log in or register"
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
  const preview = useInvitePreview(inviteId, true)
  const { accept, decline } = useAnswerInvite(inviteId)
  const [declined, setDeclined] = useState(false)
  const goHome = () => router.replace("/")

  if (declined) {
    return (
      <EmptyState
        icon={X}
        title="Invite declined"
        message="The link no longer works. Nothing else changed."
        action="Go to my recipes"
        onAction={goHome}
      />
    )
  }

  if (preview.isPending) {
    return (
      <View className="flex-row items-center gap-2" aria-busy>
        <ActivityIndicator />
        <Text className="text-muted-foreground">Loading the invite…</Text>
      </View>
    )
  }

  if (preview.isError) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="This invite link doesn't work"
        message={
          preview.error instanceof ApiError && preview.error.status === 404
            ? "It may have been used, cancelled or expired. Ask the person who invited you for a new link."
            : preview.error.message
        }
        action="Go to my recipes"
        onAction={goHome}
      />
    )
  }

  const invite = preview.data
  if (invite.alreadyMember) {
    return (
      <EmptyState
        icon={House}
        title={`You're already in ${invite.householdName}`}
        message="This invite is for a household you are a member of."
        action="Open household"
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
        {invite.inviterName} invited you to join {invite.householdName}
      </Text>
      <Text className="text-base text-muted-foreground">
        Everyone in a household shares recipes and shopping lists. You can leave
        at any time.
      </Text>
      {error && (
        <Text role="alert" className="text-sm text-destructive">
          {error.message}
        </Text>
      )}
      <Button
        icon={Check}
        label={accept.isPending ? "Joining…" : "Join household"}
        disabled={busy}
        onPress={() =>
          accept.mutate(undefined, {
            onSuccess: () => router.replace("/settings/household"),
          })
        }
      />
      <Button
        variant="ghost"
        label={decline.isPending ? "Declining…" : "Decline"}
        disabled={busy}
        onPress={() =>
          decline.mutate(undefined, { onSuccess: () => setDeclined(true) })
        }
      />
    </Card>
  )
}
