import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import type { TaskInput, TaskUpdate } from "@workspace/schemas"

import { householdStore } from "../households/store.js"

const { task } = schema

export type TaskRow = typeof task.$inferSelect

const order = [asc(task.createdAt), asc(task.id)]

/**
 * Database queries for to-do tasks. Who may see a task is decided in `access` and `forSpace`: a
 * personal task is only for its owner, a household task for every member.
 */
export function taskStore(db: Database) {
  const households = householdStore(db)

  return {
    /**
     * The tasks of a person (`householdId` null) or of a household they are in. Undefined when
     * the household does not exist or they are not a member.
     */
    async forSpace(userId: string, householdId: string | null) {
      if (householdId && !(await households.membership(householdId, userId))) {
        return undefined
      }
      return db
        .select()
        .from(task)
        .where(
          householdId
            ? eq(task.organizationId, householdId)
            : and(eq(task.userId, userId), isNull(task.organizationId))
        )
        .orderBy(...order)
    },

    /** Every task the user may see: their own and the ones of their households. */
    async listForUser(userId: string) {
      const ids = (await households.listForUser(userId)).map((m) => m.id)
      return db
        .select()
        .from(task)
        .where(
          or(
            and(isNull(task.organizationId), eq(task.userId, userId)),
            ids.length > 0 ? inArray(task.organizationId, ids) : undefined
          )
        )
        .orderBy(...order)
    },

    /** The task, if this user may see it: their own, or one of a household they are in. */
    async access(taskId: string, userId: string) {
      const [row] = await db.select().from(task).where(eq(task.id, taskId))
      if (!row) return undefined
      if (!row.organizationId) return row.userId === userId ? row : undefined
      const membership = await households.membership(row.organizationId, userId)
      return membership ? row : undefined
    },

    /** Whether the user may add tasks to this space. */
    async mayUse(userId: string, householdId: string | null) {
      if (!householdId) return true
      return !!(await households.membership(householdId, userId))
    },

    /** Whether `assigneeId` is a person a task of this space can be assigned to. */
    async mayAssign(householdId: string | null, assigneeId: string | null) {
      if (!assigneeId) return true
      if (!householdId) return false
      return !!(await households.membership(householdId, assigneeId))
    },

    /**
     * Adds a task. Sending an id that already exists changes nothing and returns the existing
     * task, so a retry after a lost connection adds nothing twice. Another person's id gives
     * `conflict`.
     */
    async create(userId: string, input: TaskInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(task)
        .values({
          id,
          userId,
          organizationId: input.householdId ?? null,
          assigneeId: input.assigneeId ?? null,
          title: input.title,
          note: input.note ?? "",
          dueDate: input.dueDate ?? null,
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created }
      const existing = await this.access(id, userId)
      return existing ? { row: existing } : { conflict: true as const }
    },

    async update(taskId: string, change: TaskUpdate) {
      const [row] = await db
        .update(task)
        .set({
          ...(change.title !== undefined && { title: change.title }),
          ...(change.note !== undefined && { note: change.note }),
          ...(change.dueDate !== undefined && { dueDate: change.dueDate }),
          ...(change.assigneeId !== undefined && {
            assigneeId: change.assigneeId,
          }),
          ...(change.done !== undefined && {
            doneAt: change.done ? new Date() : null,
          }),
        })
        .where(eq(task.id, taskId))
        .returning()
      return row
    },

    async remove(taskId: string) {
      const rows = await db
        .delete(task)
        .where(eq(task.id, taskId))
        .returning({ id: task.id })
      return rows.length > 0
    },
  }
}

export type TaskStore = ReturnType<typeof taskStore>
