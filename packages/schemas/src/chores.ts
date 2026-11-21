import { z } from "zod"

/**
 * Household chores: tasks that come back after a number of days ("switch the towels, every
 * 3 days"). A chore is checked off, disappears, and is due again at 00:00 on the day that is
 * `intervalDays` after the day it was checked. Only whole days count. The time of day when
 * the chore was checked does not matter.
 *
 * Days are plain calendar dates ("2026-11-21") in the time zone of the person who checks.
 * The server never works with time zones: the app sends the date it sees on the device.
 */

export const MAX_CHORE_INTERVAL_DAYS = 365

const name = z.string().trim().min(1).max(200)

/** A calendar day, written `YYYY-MM-DD`. */
export const ChoreDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((value) => isRealDay(value), "Not a real date")
export type ChoreDay = z.infer<typeof ChoreDaySchema>

const intervalDays = z.number().int().min(1).max(MAX_CHORE_INTERVAL_DAYS)

export const ChoreSchema = z.object({
  id: z.string(),
  name,
  /** The chore comes back this many days after it was checked. */
  intervalDays,
  /** The day it was last checked, or null when it never was (then it is due right away). */
  lastDoneOn: ChoreDaySchema.nullable(),
  /** The household it is shared with, or null for the person's own chore. */
  householdId: z.string().nullable(),
  createdAt: z.string(),
})
export type Chore = z.infer<typeof ChoreSchema>

/** What a client sends to add a chore. The client may choose the `id`, so a retry adds nothing twice. */
export const ChoreInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name,
  intervalDays,
  /** Empty (null) means a personal chore. */
  householdId: z.string().nullable().optional(),
})
export type ChoreInput = z.infer<typeof ChoreInputSchema>

/**
 * What a client sends to change a chore. `lastDoneOn` is how a chore is checked (today's
 * date) and how a check is undone (the date it had before, or null).
 */
export const ChoreUpdateSchema = z.object({
  name: name.optional(),
  intervalDays: intervalDays.optional(),
  lastDoneOn: ChoreDaySchema.nullable().optional(),
})
export type ChoreUpdate = z.infer<typeof ChoreUpdateSchema>

const MS_PER_DAY = 86_400_000

function isRealDay(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  )
}

/** Days as numbers since 1970-01-01. Calendar maths with no hours, so summer time never matters. */
function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return Math.round(Date.UTC(year!, month! - 1, day!) / MS_PER_DAY)
}

function dayFromNumber(value: number) {
  return new Date(value * MS_PER_DAY).toISOString().slice(0, 10)
}

/** The calendar day of a moment on this device (the device's own time zone). */
export function localDay(date: Date = new Date()): ChoreDay {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The day a chore comes back: `intervalDays` after it was checked. Null when it was never checked. */
export function choreDueDay(
  chore: Pick<Chore, "intervalDays" | "lastDoneOn">
): ChoreDay | null {
  if (!chore.lastDoneOn) return null
  return dayFromNumber(dayNumber(chore.lastDoneOn) + chore.intervalDays)
}

/** A chore is due from 00:00 on its due day. A chore that was never checked is due. */
export function isChoreDue(
  chore: Pick<Chore, "intervalDays" | "lastDoneOn">,
  today: ChoreDay
) {
  const due = choreDueDay(chore)
  return due === null || dayNumber(due) <= dayNumber(today)
}

/**
 * Whole days until a chore is due again: 0 or less when it is due now, null when it was never
 * checked. A chore checked today with an interval of 3 days is 3 days away today, 1 day away
 * the day after tomorrow, and due on day 3.
 */
export function daysUntilDue(
  chore: Pick<Chore, "intervalDays" | "lastDoneOn">,
  today: ChoreDay
) {
  const due = choreDueDay(chore)
  return due === null ? null : dayNumber(due) - dayNumber(today)
}

/**
 * Splits chores into the ones to do now and the ones that are waiting for their day. Due
 * chores keep their order. Waiting chores come in the order they return, soonest first.
 */
export function splitChores<
  T extends Pick<Chore, "intervalDays" | "lastDoneOn" | "name">,
>(chores: readonly T[], today: ChoreDay) {
  const due: T[] = []
  const later: T[] = []
  for (const chore of chores) {
    ;(isChoreDue(chore, today) ? due : later).push(chore)
  }
  later.sort(
    (a, b) =>
      (daysUntilDue(a, today) ?? 0) - (daysUntilDue(b, today) ?? 0) ||
      a.name.localeCompare(b.name)
  )
  return { due, later }
}
