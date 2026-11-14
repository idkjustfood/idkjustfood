import { Trash2 } from "lucide-react-native"
import { useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"

import { slotLabels, type Meal, type MealSlot } from "@workspace/schemas"

import { RecipeCover } from "@/components/recipe-card"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { Stepper } from "@/components/ui/stepper"
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
        error instanceof Error ? error.message : "Something went wrong."
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
      title={`${slotLabels[slot]} · ${dayLabel(date)}`}
    >
      {meal && (
        <View className="gap-3 rounded-md border border-border p-3">
          <Text className="text-base font-semibold text-foreground">
            {meal.recipe.title}
          </Text>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-foreground">Servings</Text>
            <Stepper
              label="Servings"
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
              label="Remove"
              disabled={busy}
              className="flex-1"
              onPress={() =>
                void run(() => removeMeal.mutateAsync({ date, slot }))
              }
            />
            <Button
              label="Save servings"
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
        {meal ? "Swap for another recipe" : "Pick a recipe"}
      </Text>
      {!meal && (
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-foreground">Servings</Text>
          <Stepper
            label="Servings"
            value={servings}
            max={100}
            onChange={setLocalServings}
          />
        </View>
      )}
      <Input
        label="Search recipes"
        value={search}
        onChangeText={setSearch}
        placeholder="Search recipes"
      />
      {recipes.isPending && <LoadingState label="Loading recipes" rows={1} />}
      {recipes.isError && (
        <ErrorState
          title="Could not load recipes"
          message="Check your connection and try again."
          onRetry={() => void recipes.refetch()}
        />
      )}
      {recipes.data && usable.length === 0 && (
        <Text className="text-muted-foreground">
          {recipes.data.length === 0
            ? "You have no saved recipes yet."
            : householdId && !word
              ? "A household plan uses the household's recipes. None are shared yet."
              : "No recipe matches."}
        </Text>
      )}
      <ScrollView className="max-h-72" keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          {usable.map((recipe) => (
            <Pressable
              key={recipe.id}
              role="button"
              disabled={busy}
              accessibilityLabel={`Plan ${recipe.title}`}
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
                    ≈ {Math.round(recipe.nutrition.calories)} kcal per serving
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
      <Button variant="outline" label="Cancel" onPress={onClose} />
    </Sheet>
  )
}
