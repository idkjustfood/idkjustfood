import {
  mealSlots,
  type MealSlot,
  type PlanDay,
  type PlanGoals,
  type Unfilled,
} from "./planner.js"
import { isMealTag, type MealTag, type TagKey } from "./tags.js"

/** What the planner needs to know about a saved recipe. */
export type PlannableRecipe = {
  id: string
  title: string
  tags: TagKey[]
  /** Per serving, an estimate. Null when the recipe has none. */
  calories: number | null
  prepMinutes: number | null
  cookMinutes: number | null
}

/** A meal that is already planned and stays as it is. */
export type ExistingMeal = {
  date: string
  slot: MealSlot
  recipeId: string
  calories: number | null
}

export type AutoPlanInput = {
  recipes: PlannableRecipe[]
  goals: PlanGoals
  days: PlanDay[]
  /** Servings for days that don't say their own. */
  servings: number
  existing?: ExistingMeal[]
}

export type PlannedMeal = {
  date: string
  slot: MealSlot
  recipeId: string
  servings: number
}

export type AutoPlanResult = {
  meals: PlannedMeal[]
  unfilled: Unfilled[]
  notes: string[]
}

/** How the day's calories are shared between the three meals. */
const slotShare: Record<MealSlot, number> = {
  breakfast: 0.3,
  midday: 0.4,
  afternoon: 0.3,
}

/**
 * The meal tags (`breakfast`, `midday`, `afternoon`) have the names of the
 * slots. A recipe with one of them is only planned for a matching slot; a
 * recipe without any fits every slot.
 */
const slotTags: Record<MealSlot, MealTag> = {
  breakfast: "breakfast",
  midday: "midday",
  afternoon: "afternoon",
}

/** A recipe may be this far from a meal's calorie budget (35 %) and still count as matching. */
const CALORIE_TOLERANCE = 0.35

/** Each time a recipe was already used in this plan, it looks this much worse. */
const REPEAT_PENALTY = 0.5

/** A recipe with a matching meal-time tag is preferred for that slot. */
const TAG_BONUS = 1

/** Preparing and cooking together, or null when the recipe says neither. */
function totalMinutes(recipe: PlannableRecipe) {
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

/**
 * Fills the empty slots of the given days from saved recipes. Plain code, no
 * AI: the same input always gives the same plan, with any AI provider or none.
 *
 * - Recipes must have the wanted diet tag and fit the time limit. When a goal
 *   needs data a recipe doesn't have (a calorie estimate, a cooking time), the
 *   recipe is skipped rather than guessed, and a note says so.
 * - A calorie goal is split over the day (30 % / 40 % / 30 %). A recipe only
 *   counts as matching when its calories per serving are close to the slot's
 *   share. A slot with no matching recipe stays empty and is listed in `unfilled`.
 * - Recipes are varied: the least used recipe wins ties, and a recipe is not
 *   planned twice on one day.
 * - Days and slots the user skipped, and slots that are already planned, are left alone.
 */
export function autoPlan(input: AutoPlanInput): AutoPlanResult {
  const { goals } = input
  const notes: string[] = []

  let eligible = input.recipes
  const diet = goals.diet ?? null
  if (diet) {
    eligible = eligible.filter((r) => r.tags.includes(diet))
  }
  if (goals.maxMinutes) {
    const known = eligible.filter((r) => totalMinutes(r) !== null)
    const unknown = eligible.length - known.length
    if (unknown > 0) {
      notes.push(
        `${plural(unknown, "recipe has", "recipes have")} no cooking time and ${unknown === 1 ? "was" : "were"} skipped.`
      )
    }
    eligible = known.filter((r) => totalMinutes(r)! <= goals.maxMinutes!)
  }
  if (goals.caloriesPerDay) {
    const known = eligible.filter((r) => r.calories !== null)
    const unknown = eligible.length - known.length
    if (unknown > 0) {
      notes.push(
        `${plural(unknown, "recipe has", "recipes have")} no calorie estimate and ${unknown === 1 ? "was" : "were"} skipped.`
      )
    }
    eligible = known
  }

  const emptyReason =
    input.recipes.length === 0
      ? "You have no saved recipes yet."
      : "No matching recipe."

  const existingBy = new Map<string, ExistingMeal[]>()
  for (const meal of input.existing ?? []) {
    existingBy.set(meal.date, [...(existingBy.get(meal.date) ?? []), meal])
  }

  const used = new Map<string, number>()
  const meals: PlannedMeal[] = []
  const unfilled: Unfilled[] = []

  for (const day of input.days) {
    if (day.skip) continue
    const servings = day.servings ?? input.servings
    const kept = existingBy.get(day.date) ?? []
    const keptSlots = new Set(kept.map((m) => m.slot))
    const usedToday = new Set(kept.map((m) => m.recipeId))

    // Kept meals use up part of the day's calories; the rest is shared by the other slots.
    let budgetBase: number | null = null
    if (goals.caloriesPerDay) {
      const left =
        goals.caloriesPerDay -
        kept.reduce((sum, m) => sum + (m.calories ?? 0), 0)
      const share = mealSlots
        .filter((slot) => !keptSlots.has(slot))
        .reduce((sum, slot) => sum + slotShare[slot], 0)
      budgetBase = share > 0 ? Math.max(left, 0) / share : 0
    }

    for (const slot of mealSlots) {
      if (keptSlots.has(slot) || day.skipSlots?.includes(slot)) continue
      const budget = budgetBase === null ? null : budgetBase * slotShare[slot]

      let best: { recipe: PlannableRecipe; score: number } | undefined
      for (const recipe of eligible) {
        if (usedToday.has(recipe.id)) continue
        const own = recipe.tags.filter(isMealTag)
        const matchesSlot = own.includes(slotTags[slot])
        if (own.length > 0 && !matchesSlot) continue

        let score = (used.get(recipe.id) ?? 0) * REPEAT_PENALTY
        if (matchesSlot) score -= TAG_BONUS
        if (budget !== null) {
          const distance = Math.abs(recipe.calories! - budget)
          if (budget <= 0 || distance > budget * CALORIE_TOLERANCE) continue
          score += distance / budget
        }
        if (
          !best ||
          score < best.score ||
          (score === best.score &&
            (recipe.title.localeCompare(best.recipe.title) < 0 ||
              (recipe.title === best.recipe.title &&
                recipe.id < best.recipe.id)))
        ) {
          best = { recipe, score }
        }
      }

      if (best) {
        meals.push({ date: day.date, slot, recipeId: best.recipe.id, servings })
        used.set(best.recipe.id, (used.get(best.recipe.id) ?? 0) + 1)
        usedToday.add(best.recipe.id)
      } else {
        unfilled.push({
          date: day.date,
          slot,
          reason:
            eligible.length === 0
              ? emptyReason
              : "No matching recipe for this meal.",
        })
      }
    }
  }

  return { meals, unfilled, notes }
}
