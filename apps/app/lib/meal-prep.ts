import { addDays, mealSlots, type MealSlot } from "@workspace/schemas"

export type PrepSlot = { date: string; slot: MealSlot }

/** How many days after the cooking day can be picked for leftovers. */
export const PREP_DAYS = 7

export const prepKey = ({ date, slot }: PrepSlot) => `${date}/${slot}`

/**
 * The slots a batch can be eaten in: every slot after the cooking meal, from the rest of
 * the cooking day up to `days` days later. Leftovers can't be eaten before the cooking.
 */
export function prepSlots(
  date: string,
  slot: MealSlot,
  days = PREP_DAYS
): PrepSlot[] {
  const result: PrepSlot[] = []
  for (let offset = 0; offset <= days; offset += 1) {
    for (const name of mealSlots) {
      if (offset === 0 && mealSlots.indexOf(name) <= mealSlots.indexOf(slot)) {
        continue
      }
      result.push({ date: addDays(date, offset), slot: name })
    }
  }
  return result
}

/** The request body for planning meal prep from the chosen slots. */
export function prepRequest(input: {
  recipeId: string
  date: string
  slot: MealSlot
  servings: number
  chosen: PrepSlot[]
  leftoverServings: number
}) {
  const order = (s: PrepSlot) => `${s.date}/${mealSlots.indexOf(s.slot)}`
  return {
    recipeId: input.recipeId,
    date: input.date,
    slot: input.slot,
    servings: input.servings,
    eat: [...input.chosen]
      .sort((a, b) => order(a).localeCompare(order(b)))
      .map(({ date, slot }) => ({
        date,
        slot,
        servings: input.leftoverServings,
      })),
  }
}
