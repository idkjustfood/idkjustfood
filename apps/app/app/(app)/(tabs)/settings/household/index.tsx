import { router } from "expo-router"
import {
  Copy,
  House,
  Link2,
  LogOut,
  Package,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
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
import {
  inviteLink,
  isOwner,
  useCancelInvite,
  useCreateHousehold,
  useHousehold,
  useHouseholds,
  useInvites,
  useLeaveHousehold,
  useMembers,
  useMyUserId,
  useRemoveMember,
  type Household,
  type Member,
} from "@/lib/households"
import { copyText, inDays } from "@/lib/share"

export default function HouseholdScreen() {
  const { t } = useTranslation()
  const { household } = useHousehold()
  const { households, isPending, isError, error, refetch } = useHouseholds()

  if (isPending) {
    return (
      <Screen title={t("settings:manage.title")} back="/settings" narrow>
        <LoadingState label={t("settings:manage.loading")} rows={2} />
      </Screen>
    )
  }
  if (isError) {
    return (
      <Screen title={t("settings:manage.title")} back="/settings" narrow>
        <ErrorState
          title={t("settings:manage.loadError")}
          message={error.message}
          onRetry={() => refetch()}
        />
      </Screen>
    )
  }
  if (households.length === 0) return <CreateHousehold />
  // In the personal space there is no household to manage: pick one first.
  if (!household) {
    return (
      <Screen title={t("settings:manage.title")} back="/settings" narrow>
        <View className="gap-2">
          <Text className="px-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("settings:manage.manage")}
          </Text>
          <SpaceSwitcher />
        </View>
        <EmptyState
          icon={House}
          title={t("settings:manage.pickTitle")}
          message={t("settings:manage.pickMessage")}
        />
        <ListGroup>
        <ListRow
          icon={Package}
          title={t("settings:pantry.title")}
          detail={t("settings:pantry.rowDetailHousehold")}
          onPress={() => router.push("/settings/pantry")}
        />
      </ListGroup>

      <CreateHouseholdCard title={t("settings:manage.createAnother")} />
      </Screen>
    )
  }
  return <HouseholdDetails household={household} />
}

function CreateHousehold() {
  const { t } = useTranslation()
  return (
    <Screen title={t("settings:manage.title")} back="/settings" narrow>
      <EmptyState
        icon={House}
        title={t("settings:manage.noneTitle")}
        message={t("settings:manage.noneMessage")}
      />
      <CreateHouseholdCard />
    </Screen>
  )
}

/** Makes a household and switches to it. Also used to make a further one. */
function CreateHouseholdCard({ title }: { title?: string }) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const create = useCreateHousehold()
  const { setHouseholdId } = useAppState()
  const [created, setCreated] = useState<string | null>(null)
  const submit = () => {
    if (!name.trim()) return
    create.mutate(name.trim(), {
      onSuccess: (created) => {
        setName("")
        if (created) {
          setHouseholdId(created.id)
          setCreated(created.name)
        }
      },
    })
  }

  return (
    <Card className="gap-4 p-4">
      {title && (
        <Text role="heading" className="text-lg font-semibold text-foreground">
          {title}
        </Text>
      )}
      <Input
        label={t("settings:manage.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("settings:manage.namePlaceholder")}
        onSubmitEditing={submit}
        maxLength={80}
      />
      {created && (
        <View className="gap-2 rounded-md bg-muted p-3">
          <Text role="status" className="text-foreground">
            {t("settings:manage.createdPantry", { name: created })}
          </Text>
          <Button
            variant="outline"
            label={t("settings:manage.viewPantry")}
            onPress={() => router.push("/settings/pantry")}
          />
        </View>
      )}
      {create.error && (
        <Text role="alert" className="text-sm text-destructive">
          {create.error.message}
        </Text>
      )}
      <Button
        label={
          create.isPending
            ? t("settings:manage.creating")
            : t("settings:manage.create")
        }
        disabled={!name.trim() || create.isPending}
        onPress={submit}
      />
    </Card>
  )
}

type Confirm = { kind: "remove"; member: Member } | { kind: "leave" } | null

function HouseholdDetails({ household }: { household: Household }) {
  const { t } = useTranslation()
  const myUserId = useMyUserId()
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
      subtitle={t("settings:manage.subtitle")}
      back="/settings"
      narrow
    >
      <View className="gap-2">
        <Text className="px-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t("settings:manage.showFrom")}
        </Text>
        <SpaceSwitcher />
      </View>

      {actionError && (
        <Text role="alert" className="px-1 text-sm text-destructive">
          {actionError.message}
        </Text>
      )}

      {members.isPending ? (
        <LoadingState label={t("settings:manage.loadingMembers")} rows={2} />
      ) : members.isError ? (
        <ErrorState
          title={t("settings:manage.membersError")}
          message={members.error.message}
          onRetry={() => members.refetch()}
        />
      ) : (
        <ListGroup title={t("settings:manage.members", { count: members.data.length })}>
          {members.data.map((member) => {
            const you = member.userId === myUserId
            const removable = owner && !you && !isOwner(member.role)
            return (
              <ListRow
                key={member.id}
                title={
                  you
                    ? t("settings:manage.you", { name: member.name })
                    : member.name
                }
                detail={member.email}
                right={
                  <View className="flex-row items-center gap-1">
                    <Badge
                      label={
                        isOwner(member.role)
                          ? t("settings:manage.owner")
                          : t("settings:manage.member")
                      }
                      variant={isOwner(member.role) ? "default" : "secondary"}
                    />
                    {removable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={UserMinus}
                        label={t("settings:manage.remove", { name: member.name })}
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
        <ListGroup title={t("settings:manage.invitesTitle")}>
          {invites.isPending ? (
            <ListRow title={t("settings:manage.loadingInvites")} />
          ) : invites.isError ? (
            <ListRow
              title={t("settings:manage.invitesError")}
              detail={invites.error.message}
            />
          ) : invites.data.length === 0 ? (
            <ListRow
              icon={Link2}
              title={t("settings:manage.noInvites")}
              detail={t("settings:manage.noInvitesDetail")}
            />
          ) : (
            invites.data.map((invite) => (
              <ListRow
                key={invite.id}
                icon={Link2}
                title={
                  copied === invite.id
                    ? t("settings:manage.linkCopied")
                    : t("settings:manage.inviteLink")
                }
                detail={t("settings:manage.inviteDetail", {
                  name: invite.inviterName,
                  when: inDays(invite.expiresAt),
                })}
                right={
                  <View className="flex-row items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      icon={Copy}
                      label={t("settings:manage.copyLink")}
                      onPress={() => copy(invite.id, inviteLink(invite))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      icon={X}
                      label={t("settings:manage.cancelInvite")}
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
          label={t("settings:manage.invite")}
          onPress={() => router.push("/settings/household/invite")}
        />
      )}
      {canLeave && (
        <Button
          variant="ghost"
          icon={LogOut}
          label={t("settings:manage.leave")}
          className="self-center"
          onPress={() => setConfirm({ kind: "leave" })}
        />
      )}

      <CreateHouseholdCard title={t("settings:manage.createAnother")} />

      <Sheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === "remove"
            ? t("settings:manage.removeTitle", { name: confirm.member.name })
            : t("settings:manage.leaveTitle", { name: household.name })
        }
      >
        <Text className="text-base text-muted-foreground">
          {confirm?.kind === "remove"
            ? t("settings:manage.removeText", { name: confirm.member.name })
            : t("settings:manage.leaveText")}
        </Text>
        <Button
          variant="destructive"
          label={
            confirm?.kind === "remove"
              ? t("settings:manage.removeConfirm")
              : t("settings:manage.leave")
          }
          disabled={remove.isPending || leave.isPending}
          onPress={() => {
            if (confirm?.kind === "remove") remove.mutate(confirm.member.id)
            else leave.mutate()
            setConfirm(null)
          }}
        />
        <Button
          variant="outline"
          label={t("settings:manage.cancel")}
          onPress={() => setConfirm(null)}
        />
      </Sheet>
    </Screen>
  )
}
