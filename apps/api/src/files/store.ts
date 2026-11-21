import { randomUUID } from "node:crypto"
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"

import { hasRole, householdStore } from "../households/store.js"

const { storedFile } = schema

export type FileRow = typeof storedFile.$inferSelect

/** Database queries for files. Who may see or delete a file is decided here. */
export function fileStore(db: Database) {
  const households = householdStore(db)

  return {
    /**
     * The files of a person (`householdId` null) or of a household they are in. Undefined when
     * the household does not exist or they are not a member.
     */
    async forSpace(userId: string, householdId: string | null) {
      if (householdId && !(await households.membership(householdId, userId))) {
        return undefined
      }
      return db
        .select()
        .from(storedFile)
        .where(
          householdId
            ? eq(storedFile.organizationId, householdId)
            : and(
                eq(storedFile.userId, userId),
                isNull(storedFile.organizationId)
              )
        )
        .orderBy(desc(storedFile.createdAt), desc(storedFile.id))
    },

    /** Every file the user may see: their own and the ones of their households. */
    async listForUser(userId: string) {
      const ids = (await households.listForUser(userId)).map((m) => m.id)
      return db
        .select()
        .from(storedFile)
        .where(
          or(
            and(
              isNull(storedFile.organizationId),
              eq(storedFile.userId, userId)
            ),
            ids.length > 0 ? inArray(storedFile.organizationId, ids) : undefined
          )
        )
        .orderBy(desc(storedFile.createdAt), desc(storedFile.id))
    },

    /**
     * The file and what this user may do with it, or undefined when they may not see it at
     * all (it is someone else's personal file, or from a household they are not in).
     * Personal files: only the owner. Household files: members read, the uploader or a
     * household owner or admin deletes.
     */
    async access(fileId: string, userId: string) {
      const [row] = await db
        .select()
        .from(storedFile)
        .where(eq(storedFile.id, fileId))
      if (!row) return undefined
      if (!row.organizationId) {
        return row.userId === userId ? { row, mayDelete: true } : undefined
      }
      const membership = await households.membership(row.organizationId, userId)
      if (!membership) return undefined
      const mayDelete =
        row.userId === userId ||
        hasRole(membership.role, "owner") ||
        hasRole(membership.role, "admin")
      return { row, mayDelete }
    },

    /** Whether the user may add files to this space. */
    async mayUse(userId: string, householdId: string | null) {
      if (!householdId) return true
      return !!(await households.membership(householdId, userId))
    },

    async create(
      userId: string,
      input: {
        name: string
        mimeType: string
        sizeBytes: number
        householdId: string | null
      }
    ) {
      const id = randomUUID()
      const [row] = await db
        .insert(storedFile)
        .values({
          id,
          userId,
          organizationId: input.householdId,
          name: input.name,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: randomUUID(),
        })
        .returning()
      return row!
    },

    async remove(fileId: string) {
      await db.delete(storedFile).where(eq(storedFile.id, fileId))
    },
  }
}
