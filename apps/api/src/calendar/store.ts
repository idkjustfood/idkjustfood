import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import type {
  CalendarColor,
  CalendarEntryInput,
  CalendarEntryUpdate,
} from "@workspace/schemas"

import { householdStore } from "../households/store.js"

const { calendarEntry } = schema

export type CalendarEntryRow = Omit<
  typeof calendarEntry.$inferSelect,
  "color"
> & { color: CalendarColor }

const order = [
  asc(calendarEntry.date),
  asc(calendarEntry.createdAt),
  asc(calendarEntry.id),
]

/**
 * Database queries for calendar entries. Who may see an entry is decided in `access` and
 * `forSpace`: a personal entry is only for its owner, a household entry for every member.
 */
export function calendarStore(db: Database) {
  const households = householdStore(db)

  return {
    /**
     * The entries of a person (`householdId` null) or of a household they are in. Undefined
     * when the household does not exist or they are not a member.
     */
    async forSpace(userId: string, householdId: string | null) {
      if (householdId && !(await households.membership(householdId, userId))) {
        return undefined
      }
      return (await db
        .select()
        .from(calendarEntry)
        .where(
          householdId
            ? eq(calendarEntry.organizationId, householdId)
            : and(
                eq(calendarEntry.userId, userId),
                isNull(calendarEntry.organizationId)
              )
        )
        .orderBy(...order)) as CalendarEntryRow[]
    },

    /** Every entry the user may see: their own and the ones of their households. */
    async listForUser(userId: string) {
      const ids = (await households.listForUser(userId)).map((m) => m.id)
      return (await db
        .select()
        .from(calendarEntry)
        .where(
          or(
            and(
              isNull(calendarEntry.organizationId),
              eq(calendarEntry.userId, userId)
            ),
            ids.length > 0
              ? inArray(calendarEntry.organizationId, ids)
              : undefined
          )
        )
        .orderBy(...order)) as CalendarEntryRow[]
    },

    /** The entry, if this user may see it: their own, or one of a household they are in. */
    async access(entryId: string, userId: string) {
      const [row] = await db
        .select()
        .from(calendarEntry)
        .where(eq(calendarEntry.id, entryId))
      if (!row) return undefined
      if (!row.organizationId) return row.userId === userId ? row : undefined
      const membership = await households.membership(row.organizationId, userId)
      return membership ? row : undefined
    },

    /** Whether the user may add entries to this space. */
    async mayUse(userId: string, householdId: string | null) {
      if (!householdId) return true
      return !!(await households.membership(householdId, userId))
    },

    /**
     * Adds an entry. Sending an id that already exists changes nothing and returns the
     * existing entry, so a retry after a lost connection adds nothing twice. Another person's
     * id gives `conflict`.
     */
    async create(userId: string, input: CalendarEntryInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(calendarEntry)
        .values({
          id,
          userId,
          organizationId: input.householdId ?? null,
          title: input.title,
          color: input.color,
          date: input.date,
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created as CalendarEntryRow }
      const existing = await this.access(id, userId)
      return existing
        ? { row: existing as CalendarEntryRow }
        : { conflict: true as const }
    },

    async update(entryId: string, change: CalendarEntryUpdate) {
      const [row] = await db
        .update(calendarEntry)
        .set({
          ...(change.title !== undefined && { title: change.title }),
          ...(change.color !== undefined && { color: change.color }),
          ...(change.date !== undefined && { date: change.date }),
        })
        .where(eq(calendarEntry.id, entryId))
        .returning()
      return row as CalendarEntryRow | undefined
    },

    async remove(entryId: string) {
      const rows = await db
        .delete(calendarEntry)
        .where(eq(calendarEntry.id, entryId))
        .returning({ id: calendarEntry.id })
      return rows.length > 0
    },
  }
}

export type CalendarStore = ReturnType<typeof calendarStore>
