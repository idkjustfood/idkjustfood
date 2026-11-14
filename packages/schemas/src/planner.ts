import { z } from "zod"
import { tagsByGroup } from "./tags.js"

/** The three meals of a day, in order. */
export const mealSlots = ["breakfast", "midday", "afternoon"] as const
export type MealSlot = (typeof mealSlots)[number]
export const MealSlotSchema = z.enum(mealSlots)

export const slotLabels: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  midday: "Midday",
  afternoon: "Afternoon",
}

/** A calendar day as `YYYY-MM-DD`. No time and no time zone, so it means the same everywhere. */
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
  }, "Not a real date")

const MS_PER_DAY = 86_400_000

/** Adds (or subtracts) days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number) {
  const time = new Date(`${date}T00:00:00Z`).getTime() + days * MS_PER_DAY
  return new Date(time).toISOString().slice(0, 10)
}

/** The Monday of the week a date is in. Weeks start on Monday. */
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, -((day + 6) % 7))
}

/** The seven days of the week that starts on `start` (a Monday). */
export function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Today as `YYYY-MM-DD`, on the device's own calendar. */
export function todayString(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/** What a plan stores about the recipe in a slot, so the plan can be shown without loading recipes. */
export const MealRecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** How many servings the recipe makes as written. */
  servings: z.number().int(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  /** Per serving. Empty (null) when the recipe has no estimate. Always an estimate. */
  calories: z.number().nullable(),
})
export type MealRecipe = z.infer<typeof MealRecipeSchema>

export const MealSchema = z.object({
  date: DateSchema,
  slot: MealSlotSchema,
  /** How many servings are cooked for this meal. */
  servings: z.number().int().min(1).max(1000),
  recipe: MealRecipeSchema,
})
export type Meal = z.infer<typeof MealSchema>

export const MealPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The household the plan is shared with, or null for a personal plan. */
  householdId: z.string().nullable(),
  /** Who made the plan. */
  userId: z.string(),
  meals: z.array(MealSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type MealPlan = z.infer<typeof MealPlanSchema>

/** What a client sends to make a plan. The client may choose the `id` (a UUID). */
export const MealPlanInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(100),
  /** The household to share the plan with. Empty (null) means a personal plan. */
  householdId: z.string().nullable().optional(),
})
export type MealPlanInput = z.infer<typeof MealPlanInputSchema>

export const MealPlanRenameSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

/** Puts a recipe in a slot, replacing what is there. */
export const SetMealSchema = z.object({
  recipeId: z.string().min(1),
  servings: z.number().int().min(1).max(1000).default(2),
})
export type SetMeal = z.infer<typeof SetMealSchema>

export const MealServingsSchema = z.object({
  servings: z.number().int().min(1).max(1000),
})

/** One slot of one day. */
export type SlotKey = { date: string; slot: MealSlot }

/** The plan's meals of one week, as seven days with three slots each (empty slots are null). */
export type WeekView = {
  start: string
  days: { date: string; slots: Record<MealSlot, Meal | null> }[]
}

/** Lays the meals of the week starting on `start` out as days and slots. */
export function buildWeek(meals: Meal[], start: string): WeekView {
  const days = weekDays(weekStart(start)).map((date) => {
    const slots: Record<MealSlot, Meal | null> = {
      breakfast: null,
      midday: null,
      afternoon: null,
    }
    for (const meal of meals) {
      if (meal.date === date) slots[meal.slot] = meal
    }
    return { date, slots }
  })
  return { start: days[0]!.date, days }
}

/**
 * The calories one person eats in a day, from the recipes' estimates. `missing`
 * counts meals whose recipe has no estimate, so the total is only a lower bound.
 */
export function dayCalories(meals: (Meal | null)[]) {
  let calories = 0
  let missing = 0
  let planned = 0
  for (const meal of meals) {
    if (!meal) continue
    planned += 1
    if (meal.recipe.calories === null) missing += 1
    else calories += meal.recipe.calories
  }
  return { calories: Math.round(calories), missing, planned }
}

// ---------------------------------------------------------------------------
// Automatic planning
// ---------------------------------------------------------------------------

/** What the user wants from an automatic plan. Empty (null) means "no wish". */
export const PlanGoalsSchema = z.object({
  /** Calories one person should eat per day. Uses the recipes' estimates. */
  caloriesPerDay: z.number().int().min(500).max(10_000).nullable().optional(),
  /** A diet tag every recipe must have, for example "vegetarian" (see `tagsByGroup.diet`). */
  diet: z.enum(tagsByGroup.diet).nullable().optional(),
  /** The longest a meal may take (preparing and cooking together). */
  maxMinutes: z.number().int().min(1).max(1000).nullable().optional(),
})
export type PlanGoals = z.infer<typeof PlanGoalsSchema>

/** One day in the wizard. */
export const PlanDaySchema = z.object({
  date: DateSchema,
  /** Leave the whole day empty. */
  skip: z.boolean().optional(),
  /** Servings for this day's meals. Defaults to the request's `servings`. */
  servings: z.number().int().min(1).max(1000).optional(),
  /** Slots to leave empty on this day. */
  skipSlots: z.array(MealSlotSchema).max(3).optional(),
})
export type PlanDay = z.infer<typeof PlanDaySchema>

export const GeneratePlanSchema = z.object({
  goals: PlanGoalsSchema,
  days: z.array(PlanDaySchema).min(1).max(56),
  /** Servings for days that don't say their own. */
  servings: z.number().int().min(1).max(1000).default(2),
  /** Replace meals that are already planned. Without it only empty slots are filled. */
  overwrite: z.boolean().default(false),
})
export type GeneratePlan = z.input<typeof GeneratePlanSchema>

/** Why a slot was left empty by the automatic planner. */
export const UnfilledSchema = z.object({
  date: DateSchema,
  slot: MealSlotSchema,
  reason: z.string(),
})
export type Unfilled = z.infer<typeof UnfilledSchema>

export const GenerateResultSchema = z.object({
  plan: MealPlanSchema,
  /** Slots that were meant to be filled but had no matching recipe. They stay empty. */
  unfilled: z.array(UnfilledSchema),
  /** Plain-language remarks, for example that recipes without a calorie estimate were skipped. */
  notes: z.array(z.string()),
})
export type GenerateResult = z.infer<typeof GenerateResultSchema>

/** What a client sends to put a plan's ingredients on a shopping list. */
export const PlanToListSchema = z.object({
  listId: z.string().min(1),
  /** First day to include. Defaults to the plan's first meal. */
  from: DateSchema.optional(),
  /** Last day to include. Defaults to the plan's last meal. */
  to: DateSchema.optional(),
})
export type PlanToList = z.infer<typeof PlanToListSchema>
