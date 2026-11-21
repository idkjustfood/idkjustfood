import {
  daysUntilDue,
  mealSlots,
  splitChores,
  type Chore,
  type ChoreDay,
  type Meal,
  type MealSlot,
} from "@workspace/schemas"

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
  | {
      kind: "chore"
      id: string
      moduleId: "chores"
      name: string
      intervalDays: number
      /** How many days ago the chore came back. 0 when it is due today or was never checked. */
      overdueDays: number
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

/**
 * Chores that are due today or overdue. Chores that are waiting for their day are left out.
 * The most overdue chore comes first, then the others in the order of the chores screen.
 */
export function choreItems(
  chores: readonly Pick<
    Chore,
    "id" | "name" | "intervalDays" | "lastDoneOn"
  >[],
  today: ChoreDay
): TodayItem[] {
  return splitChores(chores, today)
    .due.map((chore) => ({
      kind: "chore" as const,
      id: chore.id,
      moduleId: "chores" as const,
      name: chore.name,
      intervalDays: chore.intervalDays,
      overdueDays: Math.max(0, -(daysUntilDue(chore, today) ?? 0)),
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays)
}

/** The timeline: meals first, then what is left to buy, then chores. Items of switched-off modules are dropped. */
export function timeline(
  items: readonly TodayItem[],
  disabled: readonly string[]
): TodayItem[] {
  const rank = (item: TodayItem) =>
    item.kind === "meal" ? 0 : item.kind === "shopping" ? 1 : 2
  return items
    .filter((item) => !disabled.includes(item.moduleId))
    .sort((a, b) => rank(a) - rank(b))
}

/** The sections of the Today screen, in the order they are shown. */
export const todaySectionIds = ["meals", "shopping", "tasks"] as const
export type TodaySectionId = (typeof todaySectionIds)[number]

const sectionOf = (item: TodayItem): TodaySectionId =>
  item.kind === "meal" ? "meals" : item.kind === "shopping" ? "shopping" : "tasks"

/**
 * Items grouped into sections. The order of sections is fixed, the order inside a section is kept,
 * and a section without items is left out. A new module adds its section id to `todaySectionIds`.
 */
export function todaySections(items: readonly TodayItem[]): {
  id: TodaySectionId
  items: TodayItem[]
}[] {
  return todaySectionIds
    .map((id) => ({ id, items: items.filter((item) => sectionOf(item) === id) }))
    .filter((section) => section.items.length > 0)
}
