import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { todayString } from "@workspace/schemas"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { useAddPlanToList, useMealsInRange } from "@/lib/planner"
import { dayLabel } from "@/lib/planner-format"
import {
  moveEnd,
  rangeFor,
  type DayRange,
  type RangeChoice,
} from "@/lib/planner-range"
import {
  useListKind,
  useShoppingActions,
  useShoppingState,
} from "@/lib/shopping"
import { cn } from "@/lib/utils"

const choices: RangeChoice[] = ["next2", "next3", "week", "all", "custom"]

/**
 * Puts the ingredients of the plan on a shopping list. Nothing is added until the
 * user taps the button here.
 */
export function AddToListSheet({
  planId,
  weekStart,
  onClose,
}: {
  planId: string
  weekStart: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { lists, loaded } = useShoppingState()
  const { sync } = useShoppingActions()
  const kind = useListKind()
  const add = useAddPlanToList(planId)
  const today = todayString()
  const [choice, setChoice] = useState<RangeChoice>("week")
  const [custom, setCustom] = useState({ from: today, to: today })
  const range: DayRange =
    choice === "custom" ? custom : rangeFor(choice, today, weekStart)
  const meals = useMealsInRange(planId, range)
  const count = meals.data
  const empty = count === 0
  const [listId, setListId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function submit() {
    // A range without meals never makes a request.
    if (!listId || empty || count === undefined) return
    setMessage(null)
    try {
      const result = await add.mutateAsync({ listId, ...(range ?? {}) })
      // The list on this device is updated from the server.
      await sync()
      const name = lists.find((l) => l.id === listId)?.name ?? t("planner:list.theList")
      setDone(
        result.added === 0
          ? t("planner:list.nothing")
          : t("planner:list.added", { count: result.added, name })
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("planner:list.error")
      )
    }
  }

  function summary() {
    const days = range
      ? range.from === range.to
        ? dayLabel(range.from)
        : `${dayLabel(range.from)} – ${dayLabel(range.to)}`
      : t("planner:list.wholePlan")
    if (count === undefined) return days
    if (empty) return `${days} · ${t("planner:list.rangeEmpty")}`
    return `${days} · ${t("planner:list.mealCount", { count })}`
  }

  return (
    <Sheet open onClose={onClose} title={t("planner:list.title")}>
      {done ? (
        <>
          <Text className="text-foreground">{done}</Text>
          <Button label={t("planner:list.done")} onPress={onClose} />
        </>
      ) : (
        <>
          <Text className="text-muted-foreground">
            {t("planner:list.intro")}
          </Text>
          <Text className="text-sm font-medium text-foreground">
            {t("planner:list.whichMeals")}
          </Text>
          <View
            role="radiogroup"
            accessibilityLabel={t("planner:list.whichMeals")}
            className="flex-row flex-wrap gap-2"
          >
            {choices.map((value) => (
              <Pressable
                key={value}
                role="radio"
                aria-checked={choice === value}
                onPress={() => setChoice(value)}
                className={cn(
                  "min-h-12 justify-center rounded-md border px-4 active:bg-accent",
                  choice === value
                    ? "border-primary bg-primary/10"
                    : "border-border"
                )}
              >
                <Text className="text-base text-foreground">
                  {value === "week"
                    ? t("planner:list.thisWeek")
                    : t(`planner:list.choice.${value}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {choice === "custom" && (
            <View className="gap-2">
              <DayStepper
                label={t("planner:list.from")}
                value={custom.from}
                onMove={(days) => setCustom(moveEnd(custom, "from", days))}
              />
              <DayStepper
                label={t("planner:list.to")}
                value={custom.to}
                onMove={(days) => setCustom(moveEnd(custom, "to", days))}
              />
            </View>
          )}
          <Text
            role="status"
            className={cn(
              "text-sm",
              empty ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {summary()}
          </Text>
          <Text className="text-sm font-medium text-foreground">
            {t("planner:list.whichList")}
          </Text>
          {loaded && lists.length === 0 && (
            <Text className="text-muted-foreground">
              {t("planner:list.none")}
            </Text>
          )}
          <View className="gap-2">
            {lists.map((list) => {
              const selected = list.id === listId
              return (
                <Pressable
                  key={list.id}
                  role="radio"
                  aria-checked={selected}
                  onPress={() => setListId(list.id)}
                  className={cn(
                    "min-h-14 justify-center rounded-md border px-4 py-2 active:bg-accent",
                    selected ? "border-primary bg-primary/10" : "border-border"
                  )}
                >
                  <Text className="text-base text-foreground">{list.name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {kind(list)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
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
              label={
                add.isPending ? t("planner:list.adding") : t("planner:list.add")
              }
              className="flex-1"
              disabled={!listId || add.isPending || empty || count === undefined}
              onPress={() => void submit()}
            />
          </View>
        </>
      )}
    </Sheet>
  )
}

/** A day with big previous and next buttons, for choosing the ends of a custom range. */
function DayStepper({
  label,
  value,
  onMove,
}: {
  label: string
  value: string
  onMove: (days: number) => void
}) {
  const { t } = useTranslation()
  return (
    <View role="group" accessibilityLabel={label} className="flex-row items-center gap-3">
      <Text className="w-14 text-sm text-muted-foreground">{label}</Text>
      <Pressable
        role="button"
        accessibilityLabel={t("planner:list.earlier", { label: label.toLowerCase() })}
        onPress={() => onMove(-1)}
        className="h-12 w-12 items-center justify-center rounded-md border border-input active:bg-accent"
      >
        <Icon as={ChevronLeft} size={20} />
      </Pressable>
      <Text className="flex-1 text-center text-base font-medium text-foreground">
        {dayLabel(value)}
      </Text>
      <Pressable
        role="button"
        accessibilityLabel={t("planner:list.later", { label: label.toLowerCase() })}
        onPress={() => onMove(1)}
        className="h-12 w-12 items-center justify-center rounded-md border border-input active:bg-accent"
      >
        <Icon as={ChevronRight} size={20} />
      </Pressable>
    </View>
  )
}
