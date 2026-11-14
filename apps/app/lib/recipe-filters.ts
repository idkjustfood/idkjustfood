import { mealTags, tagGroup, type MealTag, type TagKey } from "@workspace/schemas"

/** The meal tabs of the overview: everything, or one meal. */
export const mealTabs = ["all", ...mealTags] as const
export type MealTab = (typeof mealTabs)[number]

export type RecipeSort = "newest" | "title" | "quickest"
export const recipeSorts: readonly RecipeSort[] = ["newest", "title", "quickest"]

type Filterable = {
  title: string
  tags: readonly string[]
  prepMinutes: number | null
  cookMinutes: number | null
  createdAt: string
}

/** How many recipes each tab shows. "all" counts every recipe, also those without a meal tag. */
export function mealCounts(recipes: readonly Pick<Filterable, "tags">[]) {
  const counts: Record<MealTab, number> = { all: recipes.length, breakfast: 0, midday: 0, afternoon: 0, snack: 0 }
  for (const recipe of recipes) {
    for (const meal of mealTags) {
      if (recipe.tags.includes(meal)) counts[meal as MealTab]++
    }
  }
  return counts
}

/** The tags to ask the API for: the chosen meal plus the other filters. */
export function filterTags(meal: MealTab, others: readonly TagKey[]): TagKey[] {
  return meal === "all" ? [...others] : [meal as MealTag, ...others]
}

/** The tags that are not meals: they go in the Filters sheet, the meals have their own tabs. */
export function isOtherTag(tag: TagKey) {
  return tagGroup(tag) !== "meal"
}

/** Total time, or null when the recipe says neither prep nor cook time. */
function total(recipe: Pick<Filterable, "prepMinutes" | "cookMinutes">) {
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
}

/** A sorted copy. "quickest" puts recipes without a known time last, never guessed. */
export function sortRecipes<T extends Filterable>(recipes: readonly T[], sort: RecipeSort): T[] {
  const list = [...recipes]
  if (sort === "title") return list.sort((a, b) => a.title.localeCompare(b.title))
  if (sort === "quickest") {
    return list.sort((a, b) => {
      const x = total(a)
      const y = total(b)
      if (x === y) return a.title.localeCompare(b.title)
      if (x === null) return 1
      if (y === null) return -1
      return x - y
    })
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** The tags a compact card shows, and how many more there are. Meal first, then the rest. */
export function cardTags(tags: readonly TagKey[], max = 2) {
  const ordered = [...tags].sort((a, b) => Number(isOtherTag(a)) - Number(isOtherTag(b)))
  return { shown: ordered.slice(0, max), more: Math.max(ordered.length - max, 0) }
}
