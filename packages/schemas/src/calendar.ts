import { z } from "zod"

import { addDays, DateSchema, weekStart } from "./planner.js"

/**
 * Calendar entries: something that happens on a day, with a title and a colour. An entry is
 * personal or belongs to a household, like shopping lists and chores.
 *
 * Days are plain calendar dates ("2026-11-21"). The server never works with time zones: the
 * app sends the date it sees on the device. An entry has no time of day (yet).
 */

/**
 * The colours an entry can have. They are names of the app's design tokens (`tone-<name>`),
 * not colour values, so every theme can draw them in its own way.
 */
export const calendarColors = [
  "rose",
  "peach",
  "butter",
  "sage",
  "sky",
  "lavender",
] as const
export type CalendarColor = (typeof calendarColors)[number]
export const CalendarColorSchema = z.enum(calendarColors)

const title = z.string().trim().min(1).max(200)

export const CalendarEntrySchema = z.object({
  id: z.string(),
  title,
  color: CalendarColorSchema,
  /** The day of the entry, `YYYY-MM-DD`. */
  date: DateSchema,
  /** The household the entry belongs to, or null for the person's own entry. */
  householdId: z.string().nullable(),
  createdAt: z.string(),
})
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>

/** What a client sends to add an entry. The client may choose the `id`, so a retry adds nothing twice. */
export const CalendarEntryInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title,
  color: CalendarColorSchema,
  date: DateSchema,
  /** Empty (null) means a personal entry. */
  householdId: z.string().nullable().optional(),
})
export type CalendarEntryInput = z.infer<typeof CalendarEntryInputSchema>

/** What a client sends to change an entry. Only the fields that are sent change. */
export const CalendarEntryUpdateSchema = z.object({
  title: title.optional(),
  color: CalendarColorSchema.optional(),
  date: DateSchema.optional(),
})
export type CalendarEntryUpdate = z.infer<typeof CalendarEntryUpdateSchema>

/** The entries of one day, in the order they were made. */
export function entriesOn<T extends Pick<CalendarEntry, "date">>(
  entries: readonly T[],
  date: string
): T[] {
  return entries.filter((entry) => entry.date === date)
}

/** Entries grouped by day, for drawing a month: the colours of a day's entries come from here. */
export function entriesByDate<T extends Pick<CalendarEntry, "date">>(
  entries: readonly T[]
): Map<string, T[]> {
  const byDate = new Map<string, T[]>()
  for (const entry of entries) {
    const list = byDate.get(entry.date)
    if (list) list.push(entry)
    else byDate.set(entry.date, [entry])
  }
  return byDate
}

/** A month as `YYYY-MM`. */
export type CalendarMonth = string

/** The month a `YYYY-MM-DD` day is in. */
export function monthOf(date: string): CalendarMonth {
  return date.slice(0, 7)
}

/** The month `count` months after `month` (before it when negative). */
export function addMonths(month: CalendarMonth, count: number): CalendarMonth {
  const [year, number] = month.split("-").map(Number)
  const index = year! * 12 + (number! - 1) + count
  const newYear = Math.floor(index / 12)
  return `${String(newYear).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`
}

/**
 * The days to draw for a month: whole weeks, Monday first, starting with the week of the 1st
 * and ending with the week of the last day. `inMonth` is false for the days of the neighbouring
 * months that fill the first and last week.
 */
export function monthGrid(
  month: CalendarMonth
): { date: string; inMonth: boolean }[][] {
  const first = `${month}-01`
  const last = addDays(`${addMonths(month, 1)}-01`, -1)
  const weeks: { date: string; inMonth: boolean }[][] = []
  for (let start = weekStart(first); start <= last; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i)
        return { date, inMonth: monthOf(date) === month }
      })
    )
  }
  return weeks
}
