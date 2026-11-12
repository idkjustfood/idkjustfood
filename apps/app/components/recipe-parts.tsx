import { BellRing, Minus, Plus, Timer } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Pressable, Text, Vibration, View } from "react-native"

import {
  findTimers,
  formatCountdown,
  nutritionFacts,
  type Ingredient,
  type Nutrition,
  type Step,
} from "@workspace/schemas"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { formatAmount, formatMinutes, type Units } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ServingsScaler({
  servings,
  onChange,
}: {
  servings: number
  onChange: (servings: number) => void
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        icon={Minus}
        label="Fewer servings"
        disabled={servings <= 1}
        onPress={() => onChange(servings - 1)}
      />
      <Text
        aria-live="polite"
        className="min-w-24 text-center text-base font-medium text-foreground"
      >
        {servings} {servings === 1 ? "serving" : "servings"}
      </Text>
      <Button
        variant="outline"
        size="icon"
        icon={Plus}
        label="More servings"
        disabled={servings >= 1000}
        onPress={() => onChange(servings + 1)}
      />
    </View>
  )
}

export function IngredientList({
  ingredients,
  factor,
  units,
}: {
  ingredients: Ingredient[]
  factor: number
  units: Units
}) {
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
              {amount ?? "no amount"}
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
  if (seconds < 60) return `${seconds} sec`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${formatMinutes(minutes)} ${rest} sec` : formatMinutes(minutes)
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
    ? "Time is up. Tap to reset the timer"
    : running
      ? `${formatCountdown(remaining)} left. Tap to stop the timer`
      : `Start ${durationText(seconds)} timer`

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
          ? "Time is up"
          : running
            ? `${formatCountdown(remaining)} · tap to stop`
            : `${durationText(seconds)} timer`}
      </Text>
    </Pressable>
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
}: {
  recipeId: string
  steps: Step[]
}) {
  return (
    <View className="gap-5">
      {steps.map((step, i) => (
        <View key={i} className="flex-row gap-4">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
            <Text className="font-semibold text-secondary-foreground">
              {i + 1}
            </Text>
          </View>
          <View className="flex-1 gap-2">
            <Text className="text-base leading-6 text-foreground">
              {step.text}
            </Text>
            <StepTimers recipeId={recipeId} index={i} text={step.text} />
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
              <Text className="text-sm text-muted-foreground">{label}</Text>
            </View>
          )
        })}
      </View>
      <Text className="text-sm text-muted-foreground">
        Per serving. An estimate, not exact.
      </Text>
    </View>
  )
}
