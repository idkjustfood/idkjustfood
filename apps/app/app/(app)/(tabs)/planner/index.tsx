import { router } from "expo-router"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react-native"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text, View } from "react-native"

import {
  addDays,
  buildWeek,
  dayCalories,
  mealSlots,
  todayString,
  weekStart,
  type Meal,
  type MealSlot,
} from "@workspace/schemas"

import { Grid } from "@/components/grid"
import { AddToListSheet } from "@/components/planner/add-to-list-sheet"
import { SlotSheet } from "@/components/planner/slot-sheet"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { useHousehold } from "@/lib/households"
import { formatNumber } from "@/lib/format"
import { useIsWide } from "@/lib/layout"
import {
  useCreatePlan,
  useDeletePlan,
  usePlans,
  useWeek,
  type MealPlan,
} from "@/lib/planner"
import { dayLabel, weekLabel } from "@/lib/planner-format"
import { inSpace } from "@/lib/space"
import { cn } from "@/lib/utils"

type Editing = { date: string; slot: MealSlot }

/** The meal planner: a week at a time, three meals a day. */
export default function Planner() {
  const { t } = useTranslation()
  const wide = useIsWide()
  const { demo } = useAppState()
  const { household, ready } = useHousehold()
  const plans = usePlans()
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [start, setStart] = useState(() => weekStart(todayString()))
  const [editing, setEditing] = useState<Editing | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // The plans of the space being shown: personal ones, or the household's.
  const shown = inSpace(plans.data ?? [], household?.id ?? null)
  const plan = shown.find((p) => p.id === chosenId) ?? shown[0]

  const week = useWeek(plan?.id, start)
  const view = buildWeek(week.data?.meals ?? [], start)
  const mealsInWeek = view.days.reduce(
    (sum, day) => sum + mealSlots.filter((s) => day.slots[s]).length,
    0
  )
  const today = todayString()

  return (
    <Screen
      title={t("planner:title")}
      toolbar={
        <View className="gap-3">
          {!wide && <SpaceSwitcher />}
          {shown.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {shown.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={p.id === plan?.id}
                  onPress={() => setChosenId(p.id)}
                />
              ))}
              <Pressable
                role="button"
                accessibilityLabel={t("planner:newPlan")}
                onPress={() => setNewOpen(true)}
                className="h-10 flex-row items-center gap-1 rounded-full border border-dashed border-border px-4 active:bg-accent"
              >
                <Icon as={Plus} size={16} />
                <Text className="text-sm font-medium text-foreground">
                  {t("planner:newPlan")}
                </Text>
              </Pressable>
            </ScrollView>
          )}
          {plan && <WeekBar start={start} onChange={setStart} today={today} />}
        </View>
      }
      footer={
        plan && (
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              icon={ShoppingCart}
              label={t("planner:shoppingList")}
              className="flex-1"
              onPress={() => setListOpen(true)}
            />
            <Button
              icon={Sparkles}
              label={t("planner:autoPlan")}
              className="flex-1"
              onPress={() =>
                router.push({
                  pathname: "/planner/wizard",
                  params: { planId: plan.id, start },
                })
              }
            />
          </View>
        )
      }
    >
      {demo && (
        <Text className="rounded-lg border border-border bg-muted p-4 text-foreground">
          {t("planner:demo")}
        </Text>
      )}
      {!demo && plans.isPending && (
        <LoadingState label={t("planner:loadingPlans")} rows={2} />
      )}
      {!demo && plans.isError && (
        <ErrorState
          title={t("planner:plansError")}
          message={t("planner:checkConnection")}
          onRetry={() => void plans.refetch()}
        />
      )}
      {!demo && plans.data && !plan && (
        <EmptyState
          icon={CalendarDays}
          title={
            household
              ? t("planner:empty.titleHousehold", { name: household.name })
              : t("planner:empty.title")
          }
          message={t("planner:empty.message")}
          action={t("planner:empty.action")}
          onAction={() => setNewOpen(true)}
        />
      )}

      {plan && week.isError && !week.data && (
        <ErrorState
          title={t("planner:weekError")}
          message={t("planner:checkConnection")}
          onRetry={() => void week.refetch()}
        />
      )}
      {plan && week.isPending && (
        <LoadingState label={t("planner:loadingWeek")} rows={2} />
      )}
      {plan && week.data && (
        <>
          {mealsInWeek === 0 && (
            <Text className="text-muted-foreground">
              {t("planner:weekEmpty")}
            </Text>
          )}
          <Grid
            items={view.days}
            keyOf={(d) => d.date}
            render={(day) => (
              <DayCard
                date={day.date}
                slots={day.slots}
                isToday={day.date === today}
                onEdit={(slot) => setEditing({ date: day.date, slot })}
              />
            )}
          />
          <Text className="text-sm text-muted-foreground">
            {t("planner:caloriesNote")}
          </Text>
          <Button
            variant="ghost"
            icon={Trash2}
            label={t("planner:deletePlan")}
            className="self-start"
            onPress={() => setDeleteOpen(true)}
          />
        </>
      )}

      {plan && editing && (
        <SlotSheet
          key={`${editing.date}-${editing.slot}`}
          planId={plan.id}
          householdId={plan.householdId}
          date={editing.date}
          slot={editing.slot}
          meal={
            view.days.find((d) => d.date === editing.date)?.slots[
              editing.slot
            ] ?? null
          }
          onClose={() => setEditing(null)}
        />
      )}
      {plan && listOpen && (
        <AddToListSheet
          planId={plan.id}
          weekStart={start}
          onClose={() => setListOpen(false)}
        />
      )}
      <NewPlanSheet
        open={newOpen}
        householdName={household?.name}
        householdId={household?.id ?? null}
        ready={ready}
        onClose={() => setNewOpen(false)}
        onCreated={(created) => {
          setChosenId(created.id)
          setNewOpen(false)
        }}
      />
      {plan && (
        <DeleteSheet
          plan={plan}
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setChosenId(null)
            setDeleteOpen(false)
          }}
        />
      )}
    </Screen>
  )
}

/** Previous and next week, and a way back to this week. */
function WeekBar({
  start,
  onChange,
  today,
}: {
  start: string
  onChange: (start: string) => void
  today: string
}) {
  const { t } = useTranslation()
  const thisWeek = weekStart(today)
  return (
    <View className="flex-row items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        icon={ChevronLeft}
        label={t("planner:week.previous")}
        onPress={() => onChange(addDays(start, -7))}
      />
      <View className="flex-1 items-center">
        <Text className="text-base font-semibold text-foreground">
          {weekLabel(start)}
        </Text>
        {start !== thisWeek && (
          <Pressable
            role="button"
            accessibilityLabel={t("planner:week.goToThis")}
            onPress={() => onChange(thisWeek)}
            className="min-h-8 justify-center px-2"
          >
            <Text className="text-sm text-primary">
              {t("planner:week.thisWeek")}
            </Text>
          </Pressable>
        )}
      </View>
      <Button
        variant="outline"
        size="icon"
        icon={ChevronRight}
        label={t("planner:week.next")}
        onPress={() => onChange(addDays(start, 7))}
      />
    </View>
  )
}

/** One day: three slots, each tappable. */
function DayCard({
  date,
  slots,
  isToday,
  onEdit,
}: {
  date: string
  slots: Record<MealSlot, Meal | null>
  isToday: boolean
  onEdit: (slot: MealSlot) => void
}) {
  const { t } = useTranslation()
  const total = dayCalories(mealSlots.map((slot) => slots[slot]))
  return (
    <View
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        isToday ? "border-primary" : "border-border"
      )}
    >
      <View className="flex-row items-baseline justify-between gap-2 px-4 pt-3">
        <Text
          role="heading"
          className="text-base font-semibold text-foreground"
        >
          {dayLabel(date)}
          {isToday ? ` · ${t("planner:day.today")}` : ""}
        </Text>
        {total.planned > 0 && total.calories > 0 && (
          <Text className="text-xs text-muted-foreground">
            {t("planner:day.kcal", {
              value: formatNumber(total.calories),
              plus: total.missing > 0 ? "+" : "",
            })}
          </Text>
        )}
      </View>
      {total.missing > 0 && (
        <Text className="px-4 text-xs text-muted-foreground">
          {t("planner:day.missing", { count: total.missing })}
        </Text>
      )}
      <View className="pt-1">
        {mealSlots.map((slot) => {
          const meal = slots[slot]
          const slotName = t(`planner:slots.${slot}`)
          return (
            <Pressable
              key={slot}
              role="button"
              accessibilityLabel={
                meal
                  ? t("planner:day.changeLabel", {
                      slot: slotName,
                      title: meal.recipe.title,
                      count: meal.servings,
                    })
                  : t("planner:day.addLabel", { slot: slotName })
              }
              onPress={() => onEdit(slot)}
              className="min-h-14 flex-row items-center gap-3 border-t border-border px-4 py-2 active:bg-accent web:hover:bg-accent"
            >
              <Text className="w-24 text-sm text-muted-foreground">
                {slotName}
              </Text>
              {meal ? (
                <>
                  <Text
                    numberOfLines={2}
                    className="flex-1 text-base text-foreground"
                  >
                    {meal.recipe.title}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    ×{meal.servings}
                  </Text>
                </>
              ) : (
                <View className="flex-1 flex-row items-center gap-1">
                  <Icon as={Plus} size={16} className="text-muted-foreground" />
                  <Text className="text-base text-muted-foreground">
                    {t("planner:day.add")}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function NewPlanSheet({
  open,
  householdName,
  householdId,
  ready,
  onClose,
  onCreated,
}: {
  open: boolean
  householdName: string | undefined
  householdId: string | null
  /** False while the selected household is still loading. */
  ready: boolean
  onClose: () => void
  onCreated: (plan: MealPlan) => void
}) {
  const { t } = useTranslation()
  const create = useCreatePlan()
  const [name, setName] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) setMessage(null)
  }, [open])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || !ready) return
    setMessage(null)
    try {
      const plan = await create.mutateAsync({
        name: trimmed,
        householdId,
      })
      setName("")
      onCreated(plan)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("planner:new.error")
      )
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("planner:new.title")}>
      <Input
        label={t("planner:new.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("planner:new.placeholder")}
        maxLength={100}
        autoFocus
        onSubmitEditing={() => void submit()}
      />
      <Text className="text-sm text-muted-foreground">
        {householdId
          ? t("planner:new.shared", {
              name: householdName ?? t("planner:new.theHousehold"),
            })
          : t("planner:new.personal")}
      </Text>
      {message && (
        <Text role="alert" className="text-sm text-destructive">
          {message}
        </Text>
      )}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          label={t("planner:cancel")}
          className="flex-1"
          onPress={onClose}
        />
        <Button
          label={t("planner:new.create")}
          className="flex-1"
          disabled={!name.trim() || !ready || create.isPending}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  )
}

function DeleteSheet({
  plan,
  open,
  onClose,
  onDeleted,
}: {
  plan: MealPlan
  open: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const remove = useDeletePlan(plan.id)
  const [message, setMessage] = useState<string | null>(null)

  async function submit() {
    setMessage(null)
    try {
      await remove.mutateAsync()
      onDeleted()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("planner:delete.error")
      )
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("planner:delete.title")}>
      <Text className="text-foreground">
        {t("planner:delete.message", { name: plan.name })}
      </Text>
      {message && (
        <Text role="alert" className="text-sm text-destructive">
          {message}
        </Text>
      )}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          label={t("planner:cancel")}
          className="flex-1"
          onPress={onClose}
        />
        <Button
          variant="destructive"
          label={t("planner:delete.confirm")}
          className="flex-1"
          disabled={remove.isPending}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  )
}
