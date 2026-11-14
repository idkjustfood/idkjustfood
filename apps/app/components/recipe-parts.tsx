import { BellRing, Minus, Plus, Timer } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, Vibration, View } from "react-native"

import {
  findTimers,
  formatCountdown,
  groupBySection,
  nutritionFacts,
  type Ingredient,
  type Nutrition,
  type Step,
} from "@workspace/schemas"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { formatAmount, formatMinutes, type Units } from "@/lib/format"
import i18n from "@/lib/i18n"
import { highlightStep } from "@/lib/step-highlight"
import { cn } from "@/lib/utils"

export function ServingsScaler({
  servings,
  onChange,
}: {
  servings: number
  onChange: (servings: number) => void
}) {
  const { t } = useTranslation()
  return (
    <View className="flex-row items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        icon={Minus}
        label={t("recipes:parts.fewerServings")}
        disabled={servings <= 1}
        onPress={() => onChange(servings - 1)}
      />
      <Text
        aria-live="polite"
        className="min-w-24 text-center text-base font-medium text-foreground"
      >
        {t("recipes:parts.servings", { count: servings })}
      </Text>
      <Button
        variant="outline"
        size="icon"
        icon={Plus}
        label={t("recipes:parts.moreServings")}
        disabled={servings >= 1000}
        onPress={() => onChange(servings + 1)}
      />
    </View>
  )
}

/** The headline of a section ("Sauce", "Dough") above its ingredients or steps. */
export function SectionHeading({ name }: { name: string }) {
  return (
    <Text
      role="heading"
      aria-level={3}
      className="text-lg font-semibold text-foreground"
    >
      {name}
    </Text>
  )
}

/**
 * The ingredients. A recipe with sections shows each headline with its
 * ingredients below it; one without looks like a plain list.
 */
export function IngredientList({
  ingredients,
  factor,
  units,
}: {
  ingredients: Ingredient[]
  factor: number
  units: Units
}) {
  const groups = groupBySection(ingredients)
  return (
    <View className="gap-4">
      {groups.map((group) => (
        <View key={group.name ?? ""} className="gap-1">
          {group.name && <SectionHeading name={group.name} />}
          <IngredientRows
            ingredients={group.items.map(({ item }) => item)}
            factor={factor}
            units={units}
          />
        </View>
      ))}
    </View>
  )
}

function IngredientRows({
  ingredients,
  factor,
  units,
}: {
  ingredients: Ingredient[]
  factor: number
  units: Units
}) {
  const { t } = useTranslation()
  return (
    <View>
      {ingredients.map((ingredient, i) => {
        const amount = formatAmount(ingredient, factor, units)
        return (
          <View
            key={i}
            className={cn(
              "flex-row gap-3 py-3",
              i > 0 && "border-t border-border"
            )}
          >
            <Text
              className={cn(
                "w-24 text-base",
                amount
                  ? "font-semibold text-foreground"
                  : "italic text-muted-foreground"
              )}
            >
              {amount ?? t("recipes:parts.noAmount")}
            </Text>
            <View className="flex-1">
              <Text className="text-base text-foreground">
                {ingredient.name}
              </Text>
              {ingredient.note && (
                <Text className="text-sm text-muted-foreground">
                  {ingredient.note}
                </Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

/**
 * When running timers end, by timer id. Kept outside the component so a timer
 * keeps running when the screen changes, for example to the next step.
 */
const endTimes = new Map<string, number>()

function durationText(seconds: number) {
  if (seconds < 60) return i18n.t("recipes:timer.seconds", { count: seconds })
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest
    ? `${formatMinutes(minutes)} ${i18n.t("recipes:timer.seconds", { count: rest })}`
    : formatMinutes(minutes)
}

/** A tap-to-start countdown found in a step. Tap again to stop it. */
export function TimerButton({
  id,
  seconds,
  large,
}: {
  /** Tells timers apart, for example "<recipe id>:<step>:<n>". */
  id: string
  seconds: number
  large?: boolean
}) {
  const { t } = useTranslation()
  const [endsAt, setEndsAt] = useState<number | null>(endTimes.get(id) ?? null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (endsAt === null) return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [endsAt])

  const remaining = endsAt === null ? seconds : Math.max(0, (endsAt - now) / 1000)
  const running = endsAt !== null && remaining > 0
  const finished = endsAt !== null && remaining <= 0

  useEffect(() => {
    if (finished) Vibration.vibrate([0, 500, 300, 500, 300, 500])
  }, [finished])

  function toggle() {
    if (endsAt === null) {
      const end = Date.now() + seconds * 1000
      endTimes.set(id, end)
      setEndsAt(end)
    } else {
      endTimes.delete(id)
      setEndsAt(null)
    }
  }

  const label = finished
    ? t("recipes:timer.timeUpLabel")
    : running
      ? t("recipes:timer.runningLabel", { time: formatCountdown(remaining) })
      : t("recipes:timer.startLabel", { duration: durationText(seconds) })

  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      aria-live={finished ? "assertive" : "off"}
      onPress={toggle}
      className={cn(
        "flex-row items-center gap-2 self-start rounded-full border px-4 active:opacity-80",
        large ? "h-14" : "h-10",
        finished
          ? "border-destructive bg-destructive"
          : running
            ? "border-primary bg-primary"
            : "border-primary/40 bg-primary/10"
      )}
    >
      <Icon
        as={finished ? BellRing : Timer}
        size={large ? 24 : 18}
        className={
          running || finished ? "text-primary-foreground" : "text-primary"
        }
      />
      <Text
        className={cn(
          "font-semibold",
          large ? "text-lg" : "text-sm",
          running || finished ? "text-primary-foreground" : "text-primary"
        )}
      >
        {finished
          ? t("recipes:timer.timeUp")
          : running
            ? t("recipes:timer.running", { time: formatCountdown(remaining) })
            : t("recipes:timer.idle", { duration: durationText(seconds) })}
      </Text>
    </Pressable>
  )
}

/**
 * The text of a step with the recipe's ingredients, amounts and times in bold.
 * Only the way it is shown changes; the saved text stays as it is.
 */
export function StepText({
  text,
  ingredients,
  className,
  boldClassName = "font-bold",
  live,
}: {
  text: string
  ingredients: Pick<Ingredient, "name">[]
  className?: string
  boldClassName?: string
  /** Tells a screen reader when the step changes. */
  live?: boolean
}) {
  const { t } = useTranslation()
  // Words of the app language, and English too: a recipe can be in either.
  const words = (key: "units" | "times") =>
    [t(`common:stepWords.${key}`), t(`common:stepWords.${key}`, { lng: "en" })]
      .join(",")
      .split(",")
  const unitWords = words("units")
  const timeWords = words("times")
  const names = ingredients.map((ingredient) => ingredient.name)
  const pieces = useMemo(
    () =>
      highlightStep(text, names, { units: unitWords, times: timeWords }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, names.join("|"), unitWords.join(","), timeWords.join(",")]
  )
  return (
    <Text aria-live={live ? "polite" : undefined} className={className}>
      {pieces.map((piece, n) =>
        piece.bold ? (
          <Text key={n} className={boldClassName}>
            {piece.text}
          </Text>
        ) : (
          piece.text
        )
      )}
    </Text>
  )
}

/** The timers in a step's text, one button each. */
export function StepTimers({
  recipeId,
  index,
  text,
  large,
}: {
  recipeId: string
  index: number
  text: string
  large?: boolean
}) {
  const timers = findTimers(text)
  if (timers.length === 0) return null
  return (
    <View className="gap-2">
      {timers.map((timer, n) => (
        <TimerButton
          key={n}
          id={`${recipeId}:${index}:${n}`}
          seconds={timer.seconds}
          large={large}
        />
      ))}
    </View>
  )
}

export function StepList({
  recipeId,
  steps,
  ingredients,
}: {
  recipeId: string
  steps: Step[]
  ingredients: Pick<Ingredient, "name">[]
}) {
  // Numbers go on across sections, so a step has one number everywhere.
  return (
    <View className="gap-5">
      {groupBySection(steps).map((group) => (
        <View key={group.name ?? ""} className="gap-3">
          {group.name && <SectionHeading name={group.name} />}
          <View className="gap-5">
            {group.items.map(({ item: step, index }) => (
              <View key={index} className="flex-row gap-4">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Text className="font-semibold text-secondary-foreground">
                    {index + 1}
                  </Text>
                </View>
                <View className="flex-1 gap-2">
                  <StepText
                    text={step.text}
                    ingredients={ingredients}
                    className="text-base leading-6 text-foreground"
                  />
                  <StepTimers
                    recipeId={recipeId}
                    index={index}
                    text={step.text}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

/** True when at least one nutrition value is set. */
export const hasNutrition = (nutrition: Nutrition) =>
  nutritionFacts(nutrition).length > 0

/** Per-serving values the person entered. Empty values are left out, not shown as zero. */
export function NutritionEstimate({ nutrition }: { nutrition: Nutrition }) {
  const { t } = useTranslation()
  const facts = nutritionFacts(nutrition)
  if (facts.length === 0) return null
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {facts.map(([label, value]) => {
          const [amount, unit] = value.split(" ")
          return (
            <View
              key={label}
              className="min-w-20 flex-1 rounded-md bg-muted p-3"
            >
              <Text className="text-lg font-semibold text-foreground">
                ~{amount}
                <Text className="text-sm font-normal text-muted-foreground">
                  {" "}
                  {unit}
                </Text>
              </Text>
              <Text className="text-sm text-muted-foreground">
                {t(`recipes:parts.nutrients.${label}`, {
                  defaultValue: label,
                })}
              </Text>
            </View>
          )
        })}
      </View>
      <Text className="text-sm text-muted-foreground">
        {t("recipes:parts.perServing")}
      </Text>
    </View>
  )
}
