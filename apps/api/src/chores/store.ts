import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import type { ChoreInput, ChoreUpdate } from "@workspace/schemas"

import { householdStore } from "../households/store.js"

const { chore } = schema

export type ChoreRow = typeof chore.$inferSelect

/** Database queries for chores. Who may see a chore is decided in `access` and `forSpace`. */
export function choreStore(db: Database) {
  const households = householdStore(db)

  return {
    /**
     * The chores of a person (`householdId` null) or of a household they are in. Undefined
     * when the household does not exist or they are not a member.
     */
    async forSpace(userId: string, householdId: string | null) {
      if (householdId && !(await households.membership(householdId, userId))) {
        return undefined
      }
      return db
        .select()
        .from(chore)
        .where(
          householdId
            ? eq(chore.organizationId, householdId)
            : and(eq(chore.userId, userId), isNull(chore.organizationId))
        )
        .orderBy(asc(chore.createdAt), asc(chore.id))
    },

    /** Every chore the user may see: their own and the ones of their households. */
    async listForUser(userId: string) {
      const ids = (await households.listForUser(userId)).map((m) => m.id)
      return db
        .select()
        .from(chore)
        .where(
          or(
            and(isNull(chore.organizationId), eq(chore.userId, userId)),
            ids.length > 0 ? inArray(chore.organizationId, ids) : undefined
          )
        )
        .orderBy(asc(chore.createdAt), asc(chore.id))
    },

    /** The chore, if this user may see it: their own, or one of a household they are in. */
    async access(choreId: string, userId: string) {
      const [row] = await db.select().from(chore).where(eq(chore.id, choreId))
      if (!row) return undefined
      if (!row.organizationId) return row.userId === userId ? row : undefined
      const membership = await households.membership(row.organizationId, userId)
      return membership ? row : undefined
    },

    /** Whether the user may add chores to this space. */
    async mayUse(userId: string, householdId: string | null) {
      if (!householdId) return true
      return !!(await households.membership(householdId, userId))
    },

    /**
     * Adds a chore. Sending an id that already exists changes nothing and returns the
     * existing chore, so a retry after a lost connection adds nothing twice. Another person's
     * id gives `conflict`.
     */
    async create(userId: string, input: ChoreInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(chore)
        .values({
          id,
          userId,
          organizationId: input.householdId ?? null,
          name: input.name,
          kind: input.kind ?? "chore",
          intervalDays: input.intervalDays,
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created }
      const existing = await this.access(id, userId)
      return existing ? { row: existing } : { conflict: true as const }
    },

    async update(choreId: string, change: ChoreUpdate) {
      const [row] = await db
        .update(chore)
        .set({
          ...(change.name !== undefined && { name: change.name }),
          ...(change.intervalDays !== undefined && {
            intervalDays: change.intervalDays,
          }),
          ...(change.lastDoneOn !== undefined && {
            lastDoneOn: change.lastDoneOn,
          }),
        })
        .where(eq(chore.id, choreId))
        .returning()
      return row
    },

    async remove(choreId: string) {
      const rows = await db
        .delete(chore)
        .where(eq(chore.id, choreId))
        .returning({ id: chore.id })
      return rows.length > 0
    },
  }
}

export type ChoreStore = ReturnType<typeof choreStore>
