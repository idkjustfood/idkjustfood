import { daysUntilDue, type Chore, type ChoreDay } from "@workspace/schemas"

/**
 * When a chore that is waiting comes back, as a translation key and a count. The screen
 * translates it. Kept here, without i18n, so it can be tested.
 */
export type ChoreComesBack =
  | { key: "tomorrow" }
  | { key: "inDays"; count: number }

export function choreComesBack(
  chore: Pick<Chore, "intervalDays" | "lastDoneOn">,
  today: ChoreDay
): ChoreComesBack {
  const days = daysUntilDue(chore, today) ?? 0
  return days <= 1 ? { key: "tomorrow" } : { key: "inDays", count: days }
}

/** Milliseconds from `now` until 00:00 of the next day on this device, when chores may come back. */
export function msUntilNextDay(now: Date = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}
