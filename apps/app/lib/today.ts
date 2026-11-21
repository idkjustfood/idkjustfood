import { mealSlots, type Meal, type MealSlot } from "@workspace/schemas"

/**
 * One entry on the Today timeline. Modules provide their own kind of entry; the screen decides
 * how to draw it. This file is plain logic, so it can be tested.
 */
export type TodayItem =
  | {
      kind: "meal"
      id: string
      moduleId: "planner"
      slot: MealSlot
      recipeId: string
      title: string
      servings: number
    }
  | {
      kind: "shopping"
      id: string
      moduleId: "shopping"
      listId: string
      listName: string
      open: number
    }

/** Meals eaten on `date`, in the order of the day. */
export function mealItems(meals: readonly Meal[], date: string): TodayItem[] {
  return meals
    .filter((meal) => meal.date === date)
    .sort((a, b) => mealSlots.indexOf(a.slot) - mealSlots.indexOf(b.slot))
    .map((meal) => ({
      kind: "meal",
      id: meal.id,
      moduleId: "planner",
      slot: meal.slot,
      recipeId: meal.recipe.id,
      title: meal.recipe.title,
      servings: meal.servings,
    }))
}

/** Lists that still have something to buy. Lists with everything checked are left out. */
export function shoppingItems(
  lists: readonly {
    id: string
    name: string
    items: readonly { checked: boolean }[]
  }[]
): TodayItem[] {
  return lists
    .map((list) => ({
      kind: "shopping" as const,
      id: list.id,
      moduleId: "shopping" as const,
      listId: list.id,
      listName: list.name,
      open: list.items.filter((item) => !item.checked).length,
    }))
    .filter((item) => item.open > 0)
}

/** The timeline: meals first, then what is left to buy. Items of switched-off modules are dropped. */
export function timeline(
  items: readonly TodayItem[],
  disabled: readonly string[]
): TodayItem[] {
  const rank = (item: TodayItem) => (item.kind === "meal" ? 0 : 1)
  return items
    .filter((item) => !disabled.includes(item.moduleId))
    .sort((a, b) => rank(a) - rank(b))
}
