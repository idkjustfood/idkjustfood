import { Pencil, Plus, Sparkles } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import {
  MAX_CHORE_INTERVAL_DAYS,
  splitChores,
  type Chore,
  type ChoreDay,
} from "@workspace/schemas"

import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { CheckboxBox } from "@/components/ui/checkbox"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { Stepper } from "@/components/ui/stepper"
import { choreComesBack } from "@/lib/chore-view"
import { useChoreActions, useChoreState, useToday } from "@/lib/chores"
import { useHousehold } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { inSpace } from "@/lib/space"
import { cn } from "@/lib/utils"

export default function Chores() {
  const { t } = useTranslation()
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const { chores: all, loaded, error, online, pending } = useChoreState()
  const actions = useChoreActions()
  const today = useToday()
  // null is the form for a new chore, a chore is the form for editing it.
  const [form, setForm] = useState<Chore | "new" | null>(null)

  const chores = inSpace(all, household?.id ?? null)
  const { due, later } = splitChores(chores, today)

  return (
    <Screen
      title={t("chores:title")}
      subtitle={
        household
          ? t("chores:sharedWith", { name: household.name })
          : t("chores:ownChores")
      }
      narrow
      toolbar={!wide && <SpaceSwitcher />}
      actions={
        <Button
          size="sm"
          icon={Plus}
          label={t("chores:add")}
          onPress={() => setForm("new")}
        />
      }
    >
      <OfflineBanner online={online} pending={pending} />
      {!loaded && !error && <LoadingState label={t("chores:loading")} rows={3} />}
      {!loaded && error && (
        <ErrorState
          title={t("chores:loadError.title")}
          message={t("chores:loadError.message")}
          onRetry={() => void actions.sync()}
        />
      )}
      {loaded && chores.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title={t("chores:empty.title")}
          message={t("chores:empty.message")}
          action={t("chores:add")}
          onAction={() => setForm("new")}
        />
      )}
      {loaded && chores.length > 0 && (
        <>
          <Section title={t("chores:todo", { count: due.length })}>
            {due.length === 0 ? (
              <View className="rounded-lg bg-tone-sage p-4">
                <Text className="font-semibold text-tone-sage-foreground">
                  {t("chores:allDone.title")}
                </Text>
                <Text className="text-tone-sage-foreground">
                  {t("chores:allDone.message")}
                </Text>
              </View>
            ) : (
              due.map((chore) => (
                <ChoreRow
                  key={chore.id}
                  chore={chore}
                  today={today}
                  onToggle={() => actions.check(chore.id, today)}
                  onEdit={() => setForm(chore)}
                />
              ))
            )}
          </Section>
          {later.length > 0 && (
            <Section title={t("chores:later", { count: later.length })}>
              {later.map((chore) => (
                <ChoreRow
                  key={chore.id}
                  chore={chore}
                  today={today}
                  done
                  onToggle={() => actions.undo(chore.id)}
                  onEdit={() => setForm(chore)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      <ChoreForm
        // A new key resets the fields each time the form opens for another chore.
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        chore={form === "new" || form === null ? null : form}
        open={form !== null}
        onClose={() => setForm(null)}
        householdName={household?.name}
        disabled={!ready}
        onSave={(name, intervalDays) => {
          if (form && form !== "new") {
            actions.edit(form.id, { name, intervalDays })
          } else {
            actions.add(name, intervalDays, household?.id ?? null)
          }
          setForm(null)
        }}
        onDelete={() => {
          if (form && form !== "new") actions.remove(form.id)
          setForm(null)
        }}
      />
    </Screen>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View className="gap-2">
      <Text role="heading" className="text-sm font-semibold text-muted-foreground">
        {title}
      </Text>
      <View className="gap-2">{children}</View>
    </View>
  )
}

/** One chore: the big box checks it off (or takes the check back), the pencil edits it. */
function ChoreRow({
  chore,
  today,
  done,
  onToggle,
  onEdit,
}: {
  chore: Chore
  today: ChoreDay
  done?: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation("chores")
  const comesBack = done ? choreComesBack(chore, today) : null
  return (
    <View className="min-h-16 flex-row items-center rounded-lg border border-border bg-card">
      <Pressable
        role="checkbox"
        aria-checked={!!done}
        accessibilityLabel={
          done
            ? t("undo", { name: chore.name })
            : t("markDone", { name: chore.name })
        }
        onPress={onToggle}
        className="min-h-16 flex-1 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
      >
        <CheckboxBox checked={!!done} />
        <View className="flex-1 gap-0.5">
          <Text
            className={cn(
              "text-base text-foreground",
              done && "text-muted-foreground line-through"
            )}
          >
            {chore.name}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {comesBack
              ? comesBack.key === "tomorrow"
                ? t("comesBack.tomorrow")
                : t("comesBack.inDays", { count: comesBack.count })
              : t("every", { count: chore.intervalDays })}
          </Text>
        </View>
      </Pressable>
      <Pressable
        role="button"
        accessibilityLabel={t("edit", { name: chore.name })}
        onPress={onEdit}
        className="h-16 w-14 items-center justify-center active:bg-accent"
      >
        <Icon as={Pencil} size={18} className="text-muted-foreground" />
      </Pressable>
    </View>
  )
}

function ChoreForm({
  chore,
  open,
  onClose,
  onSave,
  onDelete,
  householdName,
  disabled,
}: {
  chore: Chore | null
  open: boolean
  onClose: () => void
  onSave: (name: string, intervalDays: number) => void
  onDelete: () => void
  householdName?: string
  disabled: boolean
}) {
  const { t } = useTranslation("chores")
  const [name, setName] = useState(chore?.name ?? "")
  const [days, setDays] = useState(chore?.intervalDays ?? 7)
  const trimmed = name.trim()
  const save = () => {
    if (trimmed && !disabled) onSave(trimmed, days)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={chore ? t("form.editTitle") : t("form.newTitle")}
    >
      <Input
        label={t("form.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("form.placeholder")}
        maxLength={200}
        autoFocus={!chore}
        onSubmitEditing={save}
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("form.interval")}
        </Text>
        <View className="flex-row items-center gap-3">
          <Stepper
            value={days}
            onChange={setDays}
            min={1}
            max={MAX_CHORE_INTERVAL_DAYS}
            label={t("form.days")}
          />
          <Text className="text-base text-muted-foreground">
            {t("every", { count: days })}
          </Text>
        </View>
        <Text className="text-sm text-muted-foreground">{t("form.hint")}</Text>
      </View>
      {!chore && (
        <Text className="text-sm text-muted-foreground">
          {householdName
            ? t("form.visibleHousehold", { name: householdName })
            : t("form.visiblePersonal")}
        </Text>
      )}
      <View className="flex-row gap-3">
        {chore && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={chore ? t("form.save") : t("form.create")}
          className="flex-1"
          disabled={!trimmed || disabled}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
