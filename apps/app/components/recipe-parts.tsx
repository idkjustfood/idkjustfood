import { Minus, Plus, Timer } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { formatAmount, type Units } from "@/lib/format"
import type { Ingredient, Nutrition, Step } from "@/lib/mock-data"
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
            key={ingredient.id}
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

/** A tap-to-start timer from a step. In this prototype it only changes its look. */
export function TimerButton({
  minutes,
  large,
}: {
  minutes: number
  large?: boolean
}) {
  const [started, setStarted] = useState(false)
  return (
    <Pressable
      role="button"
      accessibilityLabel={
        started
          ? `Stop ${minutes} minute timer`
          : `Start ${minutes} minute timer`
      }
      onPress={() => setStarted((s) => !s)}
      className={cn(
        "flex-row items-center gap-2 self-start rounded-full border px-4 active:opacity-80",
        large ? "h-14" : "h-10",
        started
          ? "border-primary bg-primary"
          : "border-primary/40 bg-primary/10"
      )}
    >
      <Icon
        as={Timer}
        size={large ? 24 : 18}
        className={started ? "text-primary-foreground" : "text-primary"}
      />
      <Text
        className={cn(
          "font-semibold",
          large ? "text-lg" : "text-sm",
          started ? "text-primary-foreground" : "text-primary"
        )}
      >
        {started ? `${minutes}:00 · running` : `${minutes} min timer`}
      </Text>
    </Pressable>
  )
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <View className="gap-5">
      {steps.map((step, i) => (
        <View key={step.id} className="flex-row gap-4">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
            <Text className="font-semibold text-secondary-foreground">
              {i + 1}
            </Text>
          </View>
          <View className="flex-1 gap-2">
            <Text className="text-base leading-6 text-foreground">
              {step.text}
            </Text>
            {step.timerMinutes && <TimerButton minutes={step.timerMinutes} />}
          </View>
        </View>
      ))}
    </View>
  )
}

export function NutritionEstimate({ nutrition }: { nutrition: Nutrition }) {
  const values = [
    { label: "Calories", value: `${nutrition.kcal}`, unit: "kcal" },
    { label: "Protein", value: `${nutrition.protein}`, unit: "g" },
    { label: "Carbs", value: `${nutrition.carbs}`, unit: "g" },
    { label: "Fat", value: `${nutrition.fat}`, unit: "g" },
  ]
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {values.map((v) => (
          <View
            key={v.label}
            className="min-w-20 flex-1 rounded-md bg-muted p-3"
          >
            <Text className="text-lg font-semibold text-foreground">
              ~{v.value}
              <Text className="text-sm font-normal text-muted-foreground">
                {" "}
                {v.unit}
              </Text>
            </Text>
            <Text className="text-sm text-muted-foreground">{v.label}</Text>
          </View>
        ))}
      </View>
      <Text className="text-sm text-muted-foreground">
        Per serving. An estimate from Open Food Facts, not exact.
      </Text>
    </View>
  )
}
