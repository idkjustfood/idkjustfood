import { ChefHat, Repeat, Trash2, Unlink } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text, View } from "react-native"

import { type Meal, type MealSlot } from "@workspace/schemas"

import { PrepSheet } from "@/components/planner/prep-sheet"
import { RecipeCover } from "@/components/recipe-card"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { Stepper } from "@/components/ui/stepper"
import { formatNumber } from "@/lib/format"
import {
  useAddMeal,
  useEndMealPrep,
  useRemoveMeal,
  useUpdateMeal,
} from "@/lib/planner"
import { dayLabel } from "@/lib/planner-format"
import { useAllRecipes, type Recipe } from "@/lib/recipes"
import { cn } from "@/lib/utils"

/**
 * Plan one slot by hand. A slot can hold several recipes (a bread and a smoothie): each one
 * has its own servings and can be swapped or removed on its own, and another recipe can
 * always be added. A household plan only offers the household's recipes.
 */
export function SlotSheet({
  planId,
  householdId,
  date,
  slot,
  meals,
  onClose,
}: {
  planId: string
  /** The household of the plan, or null for a personal plan. */
  householdId: string | null
  date: string
  slot: MealSlot
  /** What is planned there now, in the order it was added. */
  meals: Meal[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const recipes = useAllRecipes()
  const addMeal = useAddMeal(planId)
  const updateMeal = useUpdateMeal(planId)
  const removeMeal = useRemoveMeal(planId)
  const endPrep = useEndMealPrep(planId)
  /** The meal whose meal prep is being planned. */
  const [prepId, setPrepId] = useState<string | null>(null)
  const prepMeal = meals.find((m) => m.id === prepId) ?? null
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [servings, setLocalServings] = useState(2)
  /** The meal the next pick replaces. Without one, a pick is added to the slot. */
  const [swappingId, setSwappingId] = useState<string | null>(null)
  const swapping = meals.find((m) => m.id === swappingId) ?? null

  const word = search.trim().toLowerCase()
  const usable = (recipes.data ?? [])
    .filter((r) => !householdId || r.householdId === householdId)
    .filter((r) => !word || r.title.toLowerCase().includes(word))

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setMessage(null)
    try {
      await action()
      after?.()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("planner:slot.error")
      )
    }
  }

  const pick = (recipe: Recipe) =>
    swapping
      ? run(
          () =>
            updateMeal.mutateAsync({
              mealId: swapping.id,
              recipeId: recipe.id,
            }),
          () => setSwappingId(null)
        )
      : run(
          () =>
            addMeal.mutateAsync({
              date,
              slot,
              recipeId: recipe.id,
              servings,
            }),
          () => setSearch("")
        )

  const busy =
    addMeal.isPending ||
    updateMeal.isPending ||
    removeMeal.isPending ||
    endPrep.isPending

  if (prepMeal) {
    return (
      <PrepSheet
        planId={planId}
        meal={prepMeal}
        onClose={() => setPrepId(null)}
      />
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${t(`planner:slots.${slot}`)} · ${dayLabel(date)}`}
    >
      {meals.map((meal) => (
        <MealCard
          key={`${meal.id}-${meal.servings}`}
          meal={meal}
          busy={busy}
          swapping={meal.id === swappingId}
          onSwap={() => {
            setMessage(null)
            setSwappingId(meal.id === swappingId ? null : meal.id)
          }}
          onRemove={() =>
            void run(
              () => removeMeal.mutateAsync({ mealId: meal.id }),
              () => {
                if (meal.id === swappingId) setSwappingId(null)
              }
            )
          }
          onPrep={() => setPrepId(meal.id)}
          onEndPrep={() =>
            void run(() => endPrep.mutateAsync({ mealId: meal.id }))
          }
          onSave={(value) =>
            void run(() =>
              updateMeal.mutateAsync({ mealId: meal.id, servings: value })
            )
          }
        />
      ))}

      <Text className="text-sm font-medium text-foreground">
        {swapping
          ? t("planner:slot.swapping", { title: swapping.recipe.title })
          : meals.length > 0
            ? t("planner:slot.addAnother")
            : t("planner:slot.pick")}
      </Text>
      {!swapping && (
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
      {recipes.isPending && (
        <LoadingState label={t("planner:slot.loading")} rows={1} />
      )}
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
              accessibilityLabel={t("planner:slot.planLabel", {
                title: recipe.title,
              })}
              onPress={() => void pick(recipe)}
              className={cn(
                "h-14 flex-row items-center gap-3 overflow-hidden rounded-md border border-border active:bg-accent web:hover:bg-accent",
                meals.some((m) => m.recipe.id === recipe.id) &&
                  "border-primary",
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
                      value: formatNumber(
                        Math.round(recipe.nutrition.calories)
                      ),
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
      <Button
        variant="outline"
        label={t("planner:slot.done")}
        onPress={onClose}
      />
    </Sheet>
  )
}

/** One recipe of the slot: its servings, and buttons to swap or remove it. */
function MealCard({
  meal,
  busy,
  swapping,
  onSwap,
  onRemove,
  onPrep,
  onEndPrep,
  onSave,
}: {
  meal: Meal
  busy: boolean
  swapping: boolean
  onSwap: () => void
  onRemove: () => void
  /** Plan meal prep from this meal (make it the cooking meal, or add more days). */
  onPrep: () => void
  /** Take the meal out of meal prep, or end the whole batch when it is the cooking meal. */
  onEndPrep: () => void
  onSave: (servings: number) => void
}) {
  const { t } = useTranslation()
  const [servings, setServings] = useState(meal.servings)
  return (
    <View
      className={cn(
        "gap-3 rounded-md border p-3",
        swapping ? "border-primary" : "border-border"
      )}
    >
      <Text className="text-base font-semibold text-foreground">
        {meal.recipe.title}
      </Text>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-foreground">{t("planner:servings")}</Text>
        <Stepper
          label={t("planner:servings")}
          value={servings}
          max={100}
          onChange={setServings}
        />
      </View>
      {meal.prep?.role === "cook" && (
        <Text className="text-sm text-muted-foreground">
          {t("planner:prep.cooks", {
            count: meal.prep.batchServings,
            meals: meal.prep.leftovers,
          })}
        </Text>
      )}
      {meal.prep?.role === "leftover" && (
        <Text className="text-sm text-muted-foreground">
          {t("planner:prep.leftoverFrom", {
            day: dayLabel(meal.prep.cookDate),
            slot: t(`planner:slots.${meal.prep.cookSlot}`),
          })}
        </Text>
      )}
      {meal.prep?.role !== "leftover" && (
        <Button
          variant="outline"
          icon={ChefHat}
          label={
            meal.prep ? t("planner:prep.addDays") : t("planner:prep.button")
          }
          disabled={busy}
          onPress={onPrep}
        />
      )}
      {meal.prep && (
        <Button
          variant="outline"
          icon={Unlink}
          label={
            meal.prep.role === "cook"
              ? t("planner:prep.end")
              : t("planner:prep.leave")
          }
          disabled={busy}
          onPress={onEndPrep}
        />
      )}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          icon={Trash2}
          label={t("planner:slot.remove")}
          disabled={busy}
          className="flex-1"
          onPress={onRemove}
        />
        <Button
          variant={swapping ? "default" : "outline"}
          icon={Repeat}
          label={
            swapping ? t("planner:slot.cancelSwap") : t("planner:slot.swap")
          }
          disabled={busy || meal.prep?.role === "cook"}
          className="flex-1"
          onPress={onSwap}
        />
      </View>
      {servings !== meal.servings && (
        <Button
          label={t("planner:slot.save")}
          disabled={busy}
          onPress={() => onSave(servings)}
        />
      )}
    </View>
  )
}
