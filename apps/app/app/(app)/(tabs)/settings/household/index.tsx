import { router } from "expo-router"
import {
  Copy,
  House,
  Link2,
  LogOut,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react-native"
import { useState } from "react"
import { Text, View } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { authClient } from "@/lib/auth-client"
import {
  inviteLink,
  isOwner,
  useCancelInvite,
  useCreateHousehold,
  useHousehold,
  useInvites,
  useLeaveHousehold,
  useMembers,
  useRemoveMember,
  type Household,
  type Member,
} from "@/lib/households"
import { copyText, inDays } from "@/lib/share"

export default function HouseholdScreen() {
  const { household, isPending, isError, error, refetch } = useHousehold()

  if (isPending) {
    return (
      <Screen title="Household" back="/settings" narrow>
        <LoadingState label="Loading your household…" rows={2} />
      </Screen>
    )
  }
  if (isError) {
    return (
      <Screen title="Household" back="/settings" narrow>
        <ErrorState
          title="Could not load your household"
          message={error.message}
          onRetry={() => refetch()}
        />
      </Screen>
    )
  }
  if (!household) return <CreateHousehold />
  return <HouseholdDetails household={household} />
}

function CreateHousehold() {
  const [name, setName] = useState("")
  const create = useCreateHousehold()
  const submit = () => {
    if (name.trim()) create.mutate(name.trim())
  }

  return (
    <Screen title="Household" back="/settings" narrow>
      <EmptyState
        icon={House}
        title="No household yet"
        message="A household shares recipes and shopping lists. Create one and invite the people you live with, or open an invite link someone sent you."
      />
      <Card className="gap-4 p-4">
        <Input
          label="Household name"
          value={name}
          onChangeText={setName}
          placeholder="For example: Flat 3B"
          onSubmitEditing={submit}
          maxLength={80}
        />
        {create.error && (
          <Text role="alert" className="text-sm text-destructive">
            {create.error.message}
          </Text>
        )}
        <Button
          label={create.isPending ? "Creating…" : "Create household"}
          disabled={!name.trim() || create.isPending}
          onPress={submit}
        />
      </Card>
    </Screen>
  )
}

type Confirm = { kind: "remove"; member: Member } | { kind: "leave" } | null

function HouseholdDetails({ household }: { household: Household }) {
  const { demo } = useAppState()
  const { data: session } = authClient.useSession()
  const myUserId = demo ? "demo-user" : session?.user.id
  const owner = isOwner(household.role)

  const members = useMembers(household.id)
  const invites = useInvites(household.id, owner)
  const remove = useRemoveMember(household.id)
  const leave = useLeaveHousehold(household.id)
  const cancel = useCancelInvite(household.id)

  const [confirm, setConfirm] = useState<Confirm>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const owners = members.data?.filter((m) => isOwner(m.role)).length ?? 0
  // The only owner can't leave; the API refuses it too.
  const canLeave = !owner || owners > 1
  const actionError = remove.error ?? leave.error ?? cancel.error

  async function copy(id: string, link: string) {
    await copyText(link)
    setCopied(id)
  }

  return (
    <Screen
      title={household.name}
      subtitle="Your household shares recipes and shopping lists."
      back="/settings"
      narrow
    >
      <View className="gap-2">
        <Text className="px-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Show recipes and lists from
        </Text>
        <SpaceSwitcher />
      </View>

      {actionError && (
        <Text role="alert" className="px-1 text-sm text-destructive">
          {actionError.message}
        </Text>
      )}

      {members.isPending ? (
        <LoadingState label="Loading members…" rows={2} />
      ) : members.isError ? (
        <ErrorState
          title="Could not load the members"
          message={members.error.message}
          onRetry={() => members.refetch()}
        />
      ) : (
        <ListGroup title={`Members (${members.data.length})`}>
          {members.data.map((member) => {
            const you = member.userId === myUserId
            const removable = owner && !you && !isOwner(member.role)
            return (
              <ListRow
                key={member.id}
                title={you ? `${member.name} (you)` : member.name}
                detail={member.email}
                right={
                  <View className="flex-row items-center gap-1">
                    <Badge
                      label={isOwner(member.role) ? "owner" : "member"}
                      variant={isOwner(member.role) ? "default" : "secondary"}
                    />
                    {removable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={UserMinus}
                        label={`Remove ${member.name}`}
                        onPress={() => setConfirm({ kind: "remove", member })}
                      />
                    )}
                  </View>
                }
              />
            )
          })}
        </ListGroup>
      )}

      {owner && (
        <ListGroup title="Open invite links">
          {invites.isPending ? (
            <ListRow title="Loading…" />
          ) : invites.isError ? (
            <ListRow
              title="Could not load invites"
              detail={invites.error.message}
            />
          ) : invites.data.length === 0 ? (
            <ListRow
              icon={Link2}
              title="No open invites"
              detail="Links that nobody has used yet show up here."
            />
          ) : (
            invites.data.map((invite) => (
              <ListRow
                key={invite.id}
                icon={Link2}
                title={copied === invite.id ? "Link copied" : "Invite link"}
                detail={`Created by ${invite.inviterName} · expires ${inDays(invite.expiresAt)}`}
                right={
                  <View className="flex-row items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      icon={Copy}
                      label="Copy invite link"
                      onPress={() => copy(invite.id, inviteLink(invite))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      icon={X}
                      label="Cancel invite"
                      disabled={cancel.isPending}
                      onPress={() => cancel.mutate(invite.id)}
                    />
                  </View>
                }
              />
            ))
          )}
        </ListGroup>
      )}

      {owner && (
        <Button
          icon={UserPlus}
          label="Invite someone"
          onPress={() => router.push("/settings/household/invite")}
        />
      )}
      {canLeave && (
        <Button
          variant="ghost"
          icon={LogOut}
          label="Leave household"
          className="self-center"
          onPress={() => setConfirm({ kind: "leave" })}
        />
      )}

      <Sheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === "remove"
            ? `Remove ${confirm.member.name}?`
            : `Leave ${household.name}?`
        }
      >
        <Text className="text-base text-muted-foreground">
          {confirm?.kind === "remove"
            ? `${confirm.member.name} will no longer see this household's recipes and shopping lists. You can invite them again later.`
            : "You will no longer see this household's recipes and shopping lists. You need a new invite to come back."}
        </Text>
        <Button
          variant="destructive"
          label={confirm?.kind === "remove" ? "Remove" : "Leave household"}
          disabled={remove.isPending || leave.isPending}
          onPress={() => {
            if (confirm?.kind === "remove") remove.mutate(confirm.member.id)
            else leave.mutate()
            setConfirm(null)
          }}
        />
        <Button
          variant="outline"
          label="Cancel"
          onPress={() => setConfirm(null)}
        />
      </Sheet>
    </Screen>
  )
}
