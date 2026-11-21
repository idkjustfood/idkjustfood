import { addDays } from "@workspace/schemas"

import i18n from "@/lib/i18n"

const parse = (date: string) => new Date(`${date}T00:00:00Z`)

/** "November 2026" for a `YYYY-MM` month. */
export function monthLabel(month: string) {
  return parse(`${month}-01`).toLocaleDateString(i18n.language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "Saturday 21 November": a long label for the selected day. */
export function longDayLabel(date: string) {
  return parse(date).toLocaleDateString(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

/** Short weekday names, Monday first ("Mon", "Tue", ...). */
export function weekdayLabels() {
  const monday = "2026-11-02"
  return Array.from({ length: 7 }, (_, i) =>
    parse(addDays(monday, i)).toLocaleDateString(i18n.language, {
      weekday: "short",
      timeZone: "UTC",
    })
  )
}

/** The day of the month as a number ("21"). */
export function dayNumber(date: string) {
  return Number(date.slice(8, 10))
}
