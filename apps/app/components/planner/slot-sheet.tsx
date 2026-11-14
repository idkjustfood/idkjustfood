import { Trash2 } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text, View } from "react-native"

import { type Meal, type MealSlot } from "@workspace/schemas"

import { RecipeCover } from "@/components/recipe-card"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { Stepper } from "@/components/ui/stepper"
import { formatNumber } from "@/lib/format"
import { useRemoveMeal, useSetMeal, useSetServings } from "@/lib/planner"
import { dayLabel } from "@/lib/planner-format"
import { useAllRecipes, type Recipe } from "@/lib/recipes"
import { cn } from "@/lib/utils"

/**
 * Plan one slot by hand: pick a recipe, swap it for another, change how many servings
 * to cook, or empty the slot. A household plan only offers the household's recipes.
 */
export function SlotSheet({
  planId,
  householdId,
  date,
  slot,
  meal,
  onClose,
}: {
  planId: string
  /** The household of the plan, or null for a personal plan. */
  householdId: string | null
  date: string
  slot: MealSlot
  /** What is planned there now, if anything. */
  meal: Meal | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const recipes = useAllRecipes()
  const setMeal = useSetMeal(planId)
  const setServings = useSetServings(planId)
  const removeMeal = useRemoveMeal(planId)
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [servings, setLocalServings] = useState(meal?.servings ?? 2)

  const word = search.trim().toLowerCase()
  const usable = (recipes.data ?? [])
    .filter((r) => !householdId || r.householdId === householdId)
    .filter((r) => !word || r.title.toLowerCase().includes(word))

  async function run(action: () => Promise<unknown>) {
    setMessage(null)
    try {
      await action()
      onClose()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("planner:slot.error")
      )
    }
  }

  const pick = (recipe: Recipe) =>
    run(() =>
      setMeal.mutateAsync({ date, slot, recipeId: recipe.id, servings })
    )

  const busy =
    setMeal.isPending || setServings.isPending || removeMeal.isPending

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${t(`planner:slots.${slot}`)} · ${dayLabel(date)}`}
    >
      {meal && (
        <View className="gap-3 rounded-md border border-border p-3">
          <Text className="text-base font-semibold text-foreground">
            {meal.recipe.title}
          </Text>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-foreground">{t("planner:servings")}</Text>
            <Stepper
              label={t("planner:servings")}
              value={servings}
              max={100}
              onChange={(value) => {
                setLocalServings(value)
                setMessage(null)
              }}
            />
          </View>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              icon={Trash2}
              label={t("planner:slot.remove")}
              disabled={busy}
              className="flex-1"
              onPress={() =>
                void run(() => removeMeal.mutateAsync({ date, slot }))
              }
            />
            <Button
              label={t("planner:slot.save")}
              disabled={busy || servings === meal.servings}
              className="flex-1"
              onPress={() =>
                void run(() =>
                  setServings.mutateAsync({ date, slot, servings })
                )
              }
            />
          </View>
        </View>
      )}

      <Text className="text-sm font-medium text-foreground">
        {meal ? t("planner:slot.swap") : t("planner:slot.pick")}
      </Text>
      {!meal && (
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-foreground">{t("planner:servings")}</Text>
          <Stepper
            label={t("planner:servings")}
            value={servings}
            max={100}
            onChange={setLocalServings}
          />
        </View>
      )}
      <Input
        label={t("planner:slot.search")}
        value={search}
        onChangeText={setSearch}
        placeholder={t("planner:slot.search")}
      />
      {recipes.isPending && <LoadingState label={t("planner:slot.loading")} rows={1} />}
      {recipes.isError && (
        <ErrorState
          title={t("planner:slot.loadError")}
          message={t("planner:checkConnection")}
          onRetry={() => void recipes.refetch()}
        />
      )}
      {recipes.data && usable.length === 0 && (
        <Text className="text-muted-foreground">
          {recipes.data.length === 0
            ? t("planner:slot.noRecipes")
            : householdId && !word
              ? t("planner:slot.noHouseholdRecipes")
              : t("planner:slot.noMatch")}
        </Text>
      )}
      <ScrollView className="max-h-72" keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          {usable.map((recipe) => (
            <Pressable
              key={recipe.id}
              role="button"
              disabled={busy}
              accessibilityLabel={t("planner:slot.planLabel", { title: recipe.title })}
              onPress={() => void pick(recipe)}
              className={cn(
                "h-14 flex-row items-center gap-3 overflow-hidden rounded-md border border-border active:bg-accent web:hover:bg-accent",
                recipe.id === meal?.recipe.id && "border-primary",
                busy && "opacity-50"
              )}
            >
              <RecipeCover recipe={recipe} className="h-full w-14" />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-base text-foreground">
                  {recipe.title}
                </Text>
                {recipe.nutrition.calories !== null && (
                  <Text className="text-xs text-muted-foreground">
                    {t("planner:slot.kcalPerServing", {
                      value: formatNumber(Math.round(recipe.nutrition.calories)),
                    })}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {message && (
        <Text role="alert" className="text-sm text-destructive">
          {message}
        </Text>
      )}
      <Button variant="outline" label={t("planner:cancel")} onPress={onClose} />
    </Sheet>
  )
}
