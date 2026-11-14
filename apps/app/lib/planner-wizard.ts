import {
  addDays,
  mealSlots,
  tagsByGroup,
  weekStart,
  type GeneratePlan,
  type MealSlot,
} from "@workspace/schemas"

/** What the user typed on the goals step. Everything is optional. */
export type WizardGoals = {
  calories: string
  /** A diet tag, or "" for no wish. */
  diet: "" | (typeof tagsByGroup.diet)[number]
  maxMinutes: string
}

/** One day on the days step. */
export type WizardDay = {
  date: string
  /** False when the whole day is skipped. */
  plan: boolean
  servings: number
  /** Which of the three meals are planned. */
  slots: Record<MealSlot, boolean>
}

export const emptyGoals: WizardGoals = {
  calories: "",
  diet: "",
  maxMinutes: "",
}

/** The days of the weeks starting with the week of `start`, all planned, with the same servings. */
export function wizardDays(
  start: string,
  weeks: number,
  servings: number
): WizardDay[] {
  const first = weekStart(start)
  return Array.from({ length: weeks * 7 }, (_, i) => ({
    date: addDays(first, i),
    plan: true,
    servings,
    slots: { breakfast: true, midday: true, afternoon: true },
  }))
}

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN)

/**
 * Which goal can't be used ("calories" or "minutes"), or null when they are fine.
 * The screen turns the code into a message (`planner:wizard.problem.<code>`).
 */
export function goalsProblem(goals: WizardGoals): "calories" | "minutes" | null {
  if (goals.calories.trim()) {
    const calories = whole(goals.calories)
    if (!(calories >= 500 && calories <= 10_000)) return "calories"
  }
  if (goals.maxMinutes.trim()) {
    const minutes = whole(goals.maxMinutes)
    if (!(minutes >= 1 && minutes <= 1000)) return "minutes"
  }
  return null
}

/** How many meals the days step will ask the planner to fill. */
export function plannedMeals(days: WizardDay[]) {
  return days
    .filter((day) => day.plan)
    .reduce(
      (sum, day) => sum + mealSlots.filter((slot) => day.slots[slot]).length,
      0
    )
}

/** The request for `POST /meal-plans/{id}/generate`. Skipped days and meals are sent as skipped, never left out. */
export function toGenerateRequest(
  goals: WizardGoals,
  days: WizardDay[],
  servings: number,
  overwrite: boolean
): GeneratePlan & { servings: number; overwrite: boolean } {
  return {
    goals: {
      caloriesPerDay: goals.calories.trim() ? whole(goals.calories) : null,
      diet: goals.diet || null,
      maxMinutes: goals.maxMinutes.trim() ? whole(goals.maxMinutes) : null,
    },
    days: days.map((day) => {
      const skipSlots = mealSlots.filter((slot) => !day.slots[slot])
      if (!day.plan || skipSlots.length === mealSlots.length) {
        return { date: day.date, skip: true }
      }
      return {
        date: day.date,
        servings: day.servings,
        ...(skipSlots.length > 0 ? { skipSlots } : {}),
      }
    }),
    servings,
    overwrite,
  }
}
