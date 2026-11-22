import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"
import type { PgColumn, PgTable } from "drizzle-orm/pg-core"

import type { Database } from "@workspace/database"

import { householdStore } from "./households/store.js"

/** A table of things that are personal or belong to a household (inventory, contacts, ...). */
export type SpaceTable = PgTable & {
  id: PgColumn
  userId: PgColumn
  organizationId: PgColumn
  createdAt: PgColumn
}

type Row<T extends SpaceTable> = T["$inferSelect"]

/**
 * Database queries for things that are personal or belong to a household. Who may see a row is
 * decided here: the owner for personal rows, every member for household rows. Used by the
 * inventory and the contacts, so both follow the same rules as chores and shopping lists.
 */
export function spaceStore<T extends SpaceTable>(db: Database, table: T) {
  const households = householdStore(db)
  const order = [asc(table.createdAt), asc(table.id)] as const

  return {
    /**
     * The rows of a person (`householdId` null) or of a household they are in. Undefined when
     * the household does not exist or they are not a member.
     */
    async forSpace(userId: string, householdId: string | null) {
      if (householdId && !(await households.membership(householdId, userId))) {
        return undefined
      }
      return (await db
        .select()
        .from(table as PgTable)
        .where(
          householdId
            ? eq(table.organizationId, householdId)
            : and(eq(table.userId, userId), isNull(table.organizationId))
        )
        .orderBy(...order)) as Row<T>[]
    },

    /** Every row the user may see: their own and the ones of their households. */
    async listForUser(userId: string) {
      const ids = (await households.listForUser(userId)).map((m) => m.id)
      return (await db
        .select()
        .from(table as PgTable)
        .where(
          or(
            and(isNull(table.organizationId), eq(table.userId, userId)),
            ids.length > 0 ? inArray(table.organizationId, ids) : undefined
          )
        )
        .orderBy(...order)) as Row<T>[]
    },

    /** The row, if this user may see it: their own, or one of a household they are in. */
    async access(id: string, userId: string) {
      const [row] = (await db
        .select()
        .from(table as PgTable)
        .where(eq(table.id, id))) as Row<T>[]
      if (!row) return undefined
      const organizationId = row.organizationId as string | null
      if (!organizationId) return row.userId === userId ? row : undefined
      const membership = await households.membership(organizationId, userId)
      return membership ? row : undefined
    },

    /** Whether the user may add rows to this space. */
    async mayUse(userId: string, householdId: string | null) {
      if (!householdId) return true
      return !!(await households.membership(householdId, userId))
    },

    /**
     * Adds a row. Sending an id that already exists changes nothing and returns the existing
     * row, so a retry after a lost connection adds nothing twice. Another person's id gives
     * `conflict`.
     */
    async create(
      userId: string,
      input: { id?: string; householdId?: string | null },
      values: Record<string, unknown>
    ) {
      const id = input.id ?? randomUUID()
      const [created] = (await db
        .insert(table)
        .values({
          ...values,
          id,
          userId,
          organizationId: input.householdId ?? null,
        } as T["$inferInsert"])
        .onConflictDoNothing()
        .returning()) as Row<T>[]
      if (created) return { row: created }
      const existing = await this.access(id, userId)
      return existing ? { row: existing } : { conflict: true as const }
    },

    async update(id: string, change: Record<string, unknown>) {
      const set = Object.fromEntries(
        Object.entries(change).filter(([, value]) => value !== undefined)
      )
      if (Object.keys(set).length === 0) {
        const [row] = (await db
          .select()
          .from(table as PgTable)
          .where(eq(table.id, id))) as Row<T>[]
        return row
      }
      const [row] = (await db
        .update(table)
        .set(set as T["$inferInsert"])
        .where(eq(table.id, id))
        .returning()) as Row<T>[]
      return row
    },

    async remove(id: string) {
      const rows = await db
        .delete(table)
        .where(eq(table.id, id))
        .returning({ id: table.id })
      return rows.length > 0
    },
  }
}
