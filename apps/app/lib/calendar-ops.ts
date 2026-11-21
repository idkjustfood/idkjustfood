import type {
  CalendarColor,
  CalendarEntry,
  CalendarEntryUpdate,
} from "@workspace/schemas"

/**
 * A change to the calendar, made on this device. Changes are kept in a queue and sent to the
 * server in order, so the calendar also works without a connection. Every change uses ids
 * chosen on the device and absolute values, so sending one twice does no harm.
 */
export type CalendarOp =
  | {
      type: "add"
      id: string
      title: string
      color: CalendarColor
      date: string
      /** The household the entry is for, or null for a personal entry. */
      householdId: string | null
    }
  | { type: "update"; entryId: string; change: CalendarEntryUpdate }
  | { type: "remove"; entryId: string }

/** The entries after one change. Never changes its input. */
export function applyCalendarOp(
  entries: CalendarEntry[],
  op: CalendarOp,
  now = new Date().toISOString()
): CalendarEntry[] {
  switch (op.type) {
    case "add":
      if (entries.some((entry) => entry.id === op.id)) return entries
      return [
        ...entries,
        {
          id: op.id,
          title: op.title,
          color: op.color,
          date: op.date,
          householdId: op.householdId,
          createdAt: now,
        },
      ]
    case "update":
      return entries.map((entry) =>
        entry.id === op.entryId ? { ...entry, ...definedOnly(op.change) } : entry
      )
    case "remove":
      return entries.filter((entry) => entry.id !== op.entryId)
  }
}

/** The server's entries with the changes that are still waiting to be sent put on top. */
export function applyCalendarOps(entries: CalendarEntry[], queue: CalendarOp[]) {
  return queue.reduce((all, op) => applyCalendarOp(all, op), entries)
}

/** A change without the fields that were not given. */
function definedOnly(change: CalendarEntryUpdate): Partial<CalendarEntry> {
  const result: Partial<CalendarEntry> = {}
  if (change.title !== undefined) result.title = change.title
  if (change.color !== undefined) result.color = change.color
  if (change.date !== undefined) result.date = change.date
  return result
}
