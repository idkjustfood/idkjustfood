import { addDays } from "@workspace/schemas"

import i18n from "@/lib/i18n"

const parse = (date: string) => new Date(`${date}T00:00:00Z`)

/** "Mon 5 Jan". Dates are calendar days, so no time zone shifts them. */
export function dayLabel(date: string) {
  return parse(date).toLocaleDateString(i18n.language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

/** "5 Jan – 11 Jan" for the week starting on `start`. */
export function weekLabel(start: string) {
  const short = (date: string) =>
    parse(date).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
  return `${short(start)} – ${short(addDays(start, 6))}`
}
