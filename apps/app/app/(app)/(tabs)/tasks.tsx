import {
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Pencil,
  Plus,
  User,
} from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { addDays, sortTasks, type Task } from "@workspace/schemas"

import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { CheckboxBox } from "@/components/ui/checkbox"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { longDayLabel } from "@/lib/calendar-format"
import { useToday } from "@/lib/chores"
import { useHousehold, useMembers } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { inSpace } from "@/lib/space"
import { useTodoActions, useTodoState } from "@/lib/todos"
import { cn } from "@/lib/utils"

/**
 * To-do tasks, one-off things to do. The screen shows the tasks of the selected space (personal or
 * one household). A household task can be assigned to a member. Open tasks come first, soonest
 * due day first; done tasks are listed below and can be opened again.
 */
export default function Tasks() {
  const { t } = useTranslation("tasks")
  const wide = useIsWide()
  const today = useToday()
  const { household, ready } = useHousehold()
  const { tasks: all, loaded, error, online, pending } = useTodoState()
  const actions = useTodoActions()
  const members = useMembers(household?.id).data ?? []
  // "new" is the form for a new task, a task is the form for changing it.
  const [form, setForm] = useState<Task | "new" | null>(null)

  const tasks = sortTasks(inSpace(all, household?.id ?? null))
  const open = tasks.filter((task) => !task.doneAt)
  const done = tasks.filter((task) => task.doneAt)
  const assignee = (task: Task) =>
    task.assigneeId
      ? (members.find((m) => m.userId === task.assigneeId)?.name ?? null)
      : null

  return (
    <Screen
      title={t("title")}
      subtitle={
        household
          ? t("sharedWith", { name: household.name })
          : t("ownTasks")
      }
      narrow
      toolbar={!wide && <SpaceSwitcher />}
      actions={
        <Button
          size="header"
          icon={Plus}
          label={t("add")}
          onPress={() => setForm("new")}
        />
      }
    >
      <OfflineBanner online={online} pending={pending} />
      {!loaded && !error && <LoadingState label={t("loading")} rows={3} />}
      {!loaded && error && (
        <ErrorState
          title={t("loadError.title")}
          message={t("loadError.message")}
          onRetry={() => void actions.sync()}
        />
      )}
      {loaded && tasks.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title={t("empty.title")}
          message={t("empty.message")}
          action={t("add")}
          onAction={() => setForm("new")}
        />
      )}
      {loaded && tasks.length > 0 && (
        <>
          <Section title={t("open", { count: open.length })}>
            {open.length === 0 ? (
              <View className="rounded-lg bg-tone-sage p-4">
                <Text className="font-semibold text-tone-sage-foreground">
                  {t("allDone.title")}
                </Text>
                <Text className="text-tone-sage-foreground">
                  {t("allDone.message")}
                </Text>
              </View>
            ) : (
              open.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  assignee={assignee(task)}
                  onToggle={() => actions.setDone(task.id, true)}
                  onEdit={() => setForm(task)}
                />
              ))
            )}
          </Section>
          {done.length > 0 && (
            <Section title={t("done", { count: done.length })}>
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  assignee={assignee(task)}
                  onToggle={() => actions.setDone(task.id, false)}
                  onEdit={() => setForm(task)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      <TaskForm
        // A new key resets the fields each time the form opens for another task.
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        task={form === "new" || form === null ? null : form}
        open={form !== null}
        today={today}
        householdName={household?.name}
        members={household ? members : []}
        disabled={!ready}
        onClose={() => setForm(null)}
        onSave={(values) => {
          if (form && form !== "new") {
            actions.edit(form.id, values)
          } else {
            const { assigneeId, ...rest } = values
            actions.add(rest, household?.id ?? null, assigneeId)
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

/** One task: the big box ticks it off (or opens it again), the pencil edits it. */
function TaskRow({
  task,
  today,
  assignee,
  onToggle,
  onEdit,
}: {
  task: Task
  today: string
  assignee: string | null
  onToggle: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation("tasks")
  const done = !!task.doneAt
  const late = !done && task.dueDate !== null && task.dueDate < today
  const details = [
    task.dueDate
      ? task.dueDate === today
        ? t("dueToday")
        : late
          ? t("overdue", { day: longDayLabel(task.dueDate) })
          : t("due", { day: longDayLabel(task.dueDate) })
      : null,
    assignee ? t("assignedTo", { name: assignee }) : null,
  ].filter(Boolean)
  return (
    <View className="min-h-16 flex-row items-center rounded-lg border border-border bg-card">
      <Pressable
        role="checkbox"
        aria-checked={done}
        accessibilityLabel={
          done
            ? t("reopen", { title: task.title })
            : t("markDone", { title: task.title })
        }
        onPress={onToggle}
        className="min-h-16 flex-1 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
      >
        <CheckboxBox checked={done} />
        <View className="flex-1 gap-0.5">
          <Text
            className={cn(
              "text-base text-foreground",
              done && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </Text>
          {details.length > 0 && (
            <Text
              className={cn(
                "text-sm text-muted-foreground",
                late && "font-medium text-destructive"
              )}
            >
              {details.join(" · ")}
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        role="button"
        accessibilityLabel={t("edit", { title: task.title })}
        onPress={onEdit}
        className="h-16 w-14 items-center justify-center active:bg-accent"
      >
        <Icon as={Pencil} size={18} className="text-muted-foreground" />
      </Pressable>
    </View>
  )
}

type Values = {
  title: string
  note: string
  dueDate: string | null
  assigneeId: string | null
}

function TaskForm({
  task,
  open,
  today,
  householdName,
  members,
  disabled,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null
  open: boolean
  today: string
  /** The household a new task goes to, or undefined for a personal task. */
  householdName?: string
  /** The people a task can be assigned to. Empty for a personal task. */
  members: { userId: string; name: string }[]
  disabled: boolean
  onClose: () => void
  onSave: (values: Values) => void
  onDelete: () => void
}) {
  const { t } = useTranslation("tasks")
  const [title, setTitle] = useState(task?.title ?? "")
  const [note, setNote] = useState(task?.note ?? "")
  const [dueDate, setDueDate] = useState<string | null>(task?.dueDate ?? null)
  const [assigneeId, setAssigneeId] = useState<string | null>(
    task?.assigneeId ?? null
  )
  const trimmed = title.trim()
  const save = () => {
    if (trimmed && !disabled) {
      onSave({ title: trimmed, note: note.trim(), dueDate, assigneeId })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task ? t("form.editTitle") : t("form.newTitle")}
    >
      <Input
        label={t("form.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("form.placeholder")}
        maxLength={200}
        autoFocus={!task}
        onSubmitEditing={save}
      />
      <Input
        label={t("form.note")}
        value={note}
        onChangeText={setNote}
        maxLength={2000}
        multiline
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("form.day")}
        </Text>
        {dueDate === null ? (
          <View className="flex-row">
            <Button
              variant="outline"
              label={t("form.addDay")}
              onPress={() => setDueDate(today)}
            />
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <Pressable
              role="button"
              accessibilityLabel={t("form.dayBefore")}
              onPress={() => setDueDate(addDays(dueDate, -1))}
              className="h-12 w-12 items-center justify-center rounded-md border border-border bg-card active:bg-accent"
            >
              <Icon as={ChevronLeft} className="text-foreground" />
            </Pressable>
            <Text className="flex-1 text-center text-base text-foreground">
              {longDayLabel(dueDate)}
            </Text>
            <Pressable
              role="button"
              accessibilityLabel={t("form.dayAfter")}
              onPress={() => setDueDate(addDays(dueDate, 1))}
              className="h-12 w-12 items-center justify-center rounded-md border border-border bg-card active:bg-accent"
            >
              <Icon as={ChevronRight} className="text-foreground" />
            </Pressable>
            <Button
              size="sm"
              variant="outline"
              label={t("form.removeDay")}
              onPress={() => setDueDate(null)}
            />
          </View>
        )}
      </View>

      {members.length > 0 && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">
            {t("form.assignee")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t("form.nobody")}
              selected={assigneeId === null}
              onPress={() => setAssigneeId(null)}
            />
            {members.map((member) => (
              <Chip
                key={member.userId}
                label={member.name}
                selected={assigneeId === member.userId}
                onPress={() => setAssigneeId(member.userId)}
              />
            ))}
          </View>
        </View>
      )}

      {!task && (
        <View className="flex-row items-center gap-1">
          <Icon as={User} size={14} className="text-muted-foreground" />
          <Text className="flex-1 text-sm text-muted-foreground">
            {householdName
              ? t("form.visibleHousehold", { name: householdName })
              : t("form.visiblePersonal")}
          </Text>
        </View>
      )}

      <View className="flex-row gap-3">
        {task && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={task ? t("form.save") : t("form.create")}
          className="flex-1"
          disabled={!trimmed || disabled}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
