import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ScrollView, Text, View } from "react-native"

import { type Meal } from "@workspace/schemas"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Sheet } from "@/components/ui/sheet"
import { Stepper } from "@/components/ui/stepper"
import { prepKey, prepRequest, prepSlots } from "@/lib/meal-prep"
import { usePlanMealPrep } from "@/lib/planner"
import { dayLabel } from "@/lib/planner-format"

/**
 * Meal prep for one meal: pick the later meals the batch is eaten in. The meal itself is
 * the one that is cooked. Nothing is bought twice: the shopping list takes the whole batch
 * from the cooking meal.
 */
export function PrepSheet({
  planId,
  meal,
  onClose,
}: {
  planId: string
  /** The cooking meal. */
  meal: Meal
  onClose: () => void
}) {
  const { t } = useTranslation()
  const plan = usePlanMealPrep(planId)
  const [chosen, setChosen] = useState<string[]>([])
  const [each, setEach] = useState(meal.servings)
  const [message, setMessage] = useState<string | null>(null)

  const options = prepSlots(meal.date, meal.slot)
  const picked = options.filter((option) => chosen.includes(prepKey(option)))
  const total =
    (meal.prep?.role === "cook" ? meal.prep.batchServings : meal.servings) +
    picked.length * each

  const toggle = (key: string) =>
    setChosen((now) =>
      now.includes(key) ? now.filter((k) => k !== key) : [...now, key]
    )

  async function submit() {
    setMessage(null)
    try {
      await plan.mutateAsync(
        prepRequest({
          recipeId: meal.recipe.id,
          date: meal.date,
          slot: meal.slot,
          servings: meal.servings,
          chosen: picked,
          leftoverServings: each,
        })
      )
      onClose()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("planner:prep.error")
      )
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("planner:prep.title", { title: meal.recipe.title })}
    >
      <Text className="text-foreground">
        {t("planner:prep.intro", {
          title: meal.recipe.title,
          day: dayLabel(meal.date),
          slot: t(`planner:slots.${meal.slot}`),
        })}
      </Text>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-foreground">
          {t("planner:prep.servingsEach")}
        </Text>
        <Stepper
          label={t("planner:prep.servingsEach")}
          value={each}
          max={100}
          onChange={setEach}
        />
      </View>
      <Text className="text-sm font-medium text-foreground">
        {t("planner:prep.pick")}
      </Text>
      <ScrollView className="max-h-72" keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap gap-2">
          {options.map((option) => {
            const key = prepKey(option)
            return (
              <Chip
                key={key}
                label={`${dayLabel(option.date)} · ${t(`planner:slots.${option.slot}`)}`}
                selected={chosen.includes(key)}
                onPress={() => toggle(key)}
              />
            )
          })}
        </View>
      </ScrollView>
      <Text className="text-sm text-muted-foreground">
        {picked.length === 0
          ? t("planner:prep.none")
          : t("planner:prep.total", { count: total })}
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
          label={t("planner:prep.plan")}
          className="flex-1"
          disabled={picked.length === 0 || plan.isPending}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  )
}
