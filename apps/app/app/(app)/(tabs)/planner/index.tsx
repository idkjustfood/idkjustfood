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
import { Pressable, ScrollView, Text, View } from "react-native"

import {
  addDays,
  buildWeek,
  dayCalories,
  mealSlots,
  slotLabels,
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
import {
  useCreatePlan,
  useDeletePlan,
  usePlans,
  useWeek,
  type MealPlan,
} from "@/lib/planner"
import { dayLabel, weekLabel } from "@/lib/planner-format"
import { cn } from "@/lib/utils"

type Editing = { date: string; slot: MealSlot }

/** The meal planner: a week at a time, three meals a day. */
export default function Planner() {
  const { space, demo } = useAppState()
  const { household } = useHousehold()
  const plans = usePlans()
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [start, setStart] = useState(() => weekStart(todayString()))
  const [editing, setEditing] = useState<Editing | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // The plans of the space being shown: personal ones, or the household's.
  const shown = (plans.data ?? []).filter((p) =>
    space === "household" ? p.householdId !== null : p.householdId === null
  )
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
      title="Meal planner"
      toolbar={
        <View className="gap-3">
          <SpaceSwitcher />
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
                accessibilityLabel="New plan"
                onPress={() => setNewOpen(true)}
                className="h-10 flex-row items-center gap-1 rounded-full border border-dashed border-border px-4 active:bg-accent"
              >
                <Icon as={Plus} size={16} />
                <Text className="text-sm font-medium text-foreground">
                  New plan
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
              label="Shopping list"
              className="flex-1"
              onPress={() => setListOpen(true)}
            />
            <Button
              icon={Sparkles}
              label="Auto-plan"
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
          Meal plans need an account. Log in to plan your meals.
        </Text>
      )}
      {!demo && plans.isPending && (
        <LoadingState label="Loading your plans" rows={2} />
      )}
      {!demo && plans.isError && (
        <ErrorState
          title="Could not load your plans"
          message="Check your connection and try again."
          onRetry={() => void plans.refetch()}
        />
      )}
      {!demo && plans.data && !plan && (
        <EmptyState
          icon={CalendarDays}
          title={
            space === "household" ? "No household plan yet" : "No meal plan yet"
          }
          message="Plan your meals by hand, or let the app fill a week from your saved recipes. Then add the ingredients to a shopping list."
          action="Make a plan"
          onAction={() => setNewOpen(true)}
        />
      )}

      {plan && week.isError && !week.data && (
        <ErrorState
          title="Could not load this week"
          message="Check your connection and try again."
          onRetry={() => void week.refetch()}
        />
      )}
      {plan && week.isPending && (
        <LoadingState label="Loading the week" rows={2} />
      )}
      {plan && week.data && (
        <>
          {mealsInWeek === 0 && (
            <Text className="text-muted-foreground">
              Nothing is planned in this week. Tap a slot to pick a recipe, or
              use Auto-plan.
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
            Calories are estimates from the recipes, for one person.
          </Text>
          <Button
            variant="ghost"
            icon={Trash2}
            label="Delete this plan"
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
          mealsInWeek={mealsInWeek}
          onClose={() => setListOpen(false)}
        />
      )}
      <NewPlanSheet
        open={newOpen}
        householdName={household?.name}
        householdId={household?.id ?? null}
        defaultHousehold={space === "household"}
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
  const thisWeek = weekStart(today)
  return (
    <View className="flex-row items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        icon={ChevronLeft}
        label="Previous week"
        onPress={() => onChange(addDays(start, -7))}
      />
      <View className="flex-1 items-center">
        <Text className="text-base font-semibold text-foreground">
          {weekLabel(start)}
        </Text>
        {start !== thisWeek && (
          <Pressable
            role="button"
            accessibilityLabel="Go to this week"
            onPress={() => onChange(thisWeek)}
            className="min-h-8 justify-center px-2"
          >
            <Text className="text-sm text-primary">This week</Text>
          </Pressable>
        )}
      </View>
      <Button
        variant="outline"
        size="icon"
        icon={ChevronRight}
        label="Next week"
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
          {isToday ? " · Today" : ""}
        </Text>
        {total.planned > 0 && total.calories > 0 && (
          <Text className="text-xs text-muted-foreground">
            ≈ {total.calories.toLocaleString("en-GB")} kcal
            {total.missing > 0 ? "+" : ""}
          </Text>
        )}
      </View>
      {total.missing > 0 && (
        <Text className="px-4 text-xs text-muted-foreground">
          {total.missing === 1
            ? "1 meal has no calorie estimate."
            : `${total.missing} meals have no calorie estimate.`}
        </Text>
      )}
      <View className="pt-1">
        {mealSlots.map((slot) => {
          const meal = slots[slot]
          return (
            <Pressable
              key={slot}
              role="button"
              accessibilityLabel={
                meal
                  ? `${slotLabels[slot]}, ${meal.recipe.title}, ${meal.servings} servings. Change`
                  : `${slotLabels[slot]}, empty. Add a meal`
              }
              onPress={() => onEdit(slot)}
              className="min-h-14 flex-row items-center gap-3 border-t border-border px-4 py-2 active:bg-accent web:hover:bg-accent"
            >
              <Text className="w-24 text-sm text-muted-foreground">
                {slotLabels[slot]}
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
                  <Text className="text-base text-muted-foreground">Add</Text>
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
  defaultHousehold,
  onClose,
  onCreated,
}: {
  open: boolean
  householdName: string | undefined
  householdId: string | null
  defaultHousehold: boolean
  onClose: () => void
  onCreated: (plan: MealPlan) => void
}) {
  const create = useCreatePlan()
  const [name, setName] = useState("")
  const [shared, setShared] = useState(defaultHousehold)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setShared(defaultHousehold && !!householdId)
      setMessage(null)
    }
  }, [open, defaultHousehold, householdId])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setMessage(null)
    try {
      const plan = await create.mutateAsync({
        name: trimmed,
        householdId: shared ? householdId : null,
      })
      setName("")
      onCreated(plan)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not make the plan."
      )
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New meal plan">
      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Our meals"
        maxLength={100}
        autoFocus
        onSubmitEditing={() => void submit()}
      />
      {householdId && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">
            Who is it for?
          </Text>
          <View className="flex-row gap-2">
            <Chip
              label="Only me"
              selected={!shared}
              onPress={() => setShared(false)}
            />
            <Chip
              label={householdName ?? "Household"}
              selected={shared}
              onPress={() => setShared(true)}
            />
          </View>
          <Text className="text-sm text-muted-foreground">
            {shared
              ? `Everyone in ${householdName ?? "the household"} can see and change this plan. It uses the household's recipes.`
              : "Only you can see this plan."}
          </Text>
        </View>
      )}
      {message && (
        <Text role="alert" className="text-sm text-destructive">
          {message}
        </Text>
      )}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          label="Cancel"
          className="flex-1"
          onPress={onClose}
        />
        <Button
          label="Create"
          className="flex-1"
          disabled={!name.trim() || create.isPending}
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
  const remove = useDeletePlan(plan.id)
  const [message, setMessage] = useState<string | null>(null)

  async function submit() {
    setMessage(null)
    try {
      await remove.mutateAsync()
      onDeleted()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not delete the plan."
      )
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Delete this plan?">
      <Text className="text-foreground">
        {plan.name} and all its meals are deleted for everyone who can see it.
        Your recipes and shopping lists stay.
      </Text>
      {message && (
        <Text role="alert" className="text-sm text-destructive">
          {message}
        </Text>
      )}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          label="Cancel"
          className="flex-1"
          onPress={onClose}
        />
        <Button
          variant="destructive"
          label="Delete"
          className="flex-1"
          disabled={remove.isPending}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  )
}
