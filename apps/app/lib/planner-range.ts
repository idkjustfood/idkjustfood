import { addDays, weekStart } from "@workspace/schemas"

/** Which meals of a plan go on a shopping list. */
export type RangeChoice = "next2" | "next3" | "week" | "all" | "custom"

/** A range of calendar days, both ends included. No dates means the whole plan. */
export type DayRange = { from: string; to: string } | null

/** The longest range the picker allows (about a year), so a typo can't ask for decades. */
export const MAX_RANGE_DAYS = 366

/** Number of days from `from` to `to`, both included. */
export function daysIn(range: { from: string; to: string }) {
  const ms = (d: string) => new Date(`${d}T00:00:00Z`).getTime()
  return Math.round((ms(range.to) - ms(range.from)) / 86_400_000) + 1
}

/**
 * The days a quick choice stands for. `today` and `shownWeek` (a Monday) come from the caller so
 * this stays a pure function. "This week" is the week shown on the planner screen.
 */
export function rangeFor(
  choice: Exclude<RangeChoice, "custom">,
  today: string,
  shownWeek: string
): DayRange {
  switch (choice) {
    case "next2":
      return { from: today, to: addDays(today, 1) }
    case "next3":
      return { from: today, to: addDays(today, 2) }
    case "week":
      return { from: shownWeek, to: addDays(shownWeek, 6) }
    case "all":
      return null
  }
}

/** Moves one end of a custom range. The other end follows when they would cross. */
export function moveEnd(
  range: { from: string; to: string },
  end: "from" | "to",
  days: number
) {
  const next = { ...range, [end]: addDays(range[end], days) }
  if (end === "from" && next.from > next.to) next.to = next.from
  if (end === "to" && next.to < next.from) next.from = next.to
  // Too long: the end that was just moved stops at the limit.
  if (daysIn(next) > MAX_RANGE_DAYS) {
    if (end === "from") next.from = addDays(next.to, -(MAX_RANGE_DAYS - 1))
    else next.to = addDays(next.from, MAX_RANGE_DAYS - 1)
  }
  return next
}

/** The week a date is in, as a range. Handy as the start of a custom range. */
export const weekRange = (date: string) => ({
  from: weekStart(date),
  to: addDays(weekStart(date), 6),
})
