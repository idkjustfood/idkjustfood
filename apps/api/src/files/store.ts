import { randomUUID } from "node:crypto"
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"

import { hasRole, householdStore } from "../households/store.js"

const { storedFile, fileFolder } = schema

export type FileRow = typeof storedFile.$inferSelect
export type FolderRow = typeof fileFolder.$inferSelect

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

    /**
     * The folder and what this user may do with it, or undefined when they may not see it.
     * The rules are the same as for files: the owner of a personal folder, or for a household
     * folder every member to look and the creator or a household owner or admin to change it.
     */
    async folderAccess(folderId: string, userId: string) {
      const [row] = await db
        .select()
        .from(fileFolder)
        .where(eq(fileFolder.id, folderId))
      if (!row) return undefined
      if (!row.organizationId) {
        return row.userId === userId ? { row, mayManage: true } : undefined
      }
      const membership = await households.membership(row.organizationId, userId)
      if (!membership) return undefined
      const mayManage =
        row.userId === userId ||
        hasRole(membership.role, "owner") ||
        hasRole(membership.role, "admin")
      return { row, mayManage }
    },

    /** Every folder the user may see: their own and the ones of their households. */
    async listFolders(userId: string, householdId?: string) {
      if (householdId) {
        if (!(await households.membership(householdId, userId)))
          return undefined
        return db
          .select()
          .from(fileFolder)
          .where(eq(fileFolder.organizationId, householdId))
          .orderBy(asc(fileFolder.name), asc(fileFolder.id))
      }
      const ids = (await households.listForUser(userId)).map((m) => m.id)
      return db
        .select()
        .from(fileFolder)
        .where(
          or(
            and(
              isNull(fileFolder.organizationId),
              eq(fileFolder.userId, userId)
            ),
            ids.length > 0 ? inArray(fileFolder.organizationId, ids) : undefined
          )
        )
        .orderBy(asc(fileFolder.name), asc(fileFolder.id))
    },

    async createFolder(
      userId: string,
      input: { name: string; color: string | null; householdId: string | null }
    ) {
      const [row] = await db
        .insert(fileFolder)
        .values({
          id: randomUUID(),
          userId,
          organizationId: input.householdId,
          name: input.name,
          color: input.color,
        })
        .returning()
      return row!
    },

    async updateFolder(
      folderId: string,
      changes: { name?: string; color?: string | null }
    ) {
      if (changes.name === undefined && changes.color === undefined) {
        const [row] = await db
          .select()
          .from(fileFolder)
          .where(eq(fileFolder.id, folderId))
        return row
      }
      const [row] = await db
        .update(fileFolder)
        .set(changes)
        .where(eq(fileFolder.id, folderId))
        .returning()
      return row
    },

    /**
     * Deletes the folder and the file rows in it. Returns the storage keys of those files, so the
     * caller can remove their bytes from the disk too.
     */
    async removeFolder(folderId: string) {
      const files = await db
        .select({ storageKey: storedFile.storageKey })
        .from(storedFile)
        .where(eq(storedFile.folderId, folderId))
      await db.delete(fileFolder).where(eq(fileFolder.id, folderId))
      return files.map((file) => file.storageKey)
    },

    /**
     * Whether `folderId` is a folder in the same space as the file would be: the same household,
     * or the same person for personal files. Null (the root) always fits.
     */
    async folderFits(
      folderId: string | null,
      userId: string,
      householdId: string | null
    ) {
      if (!folderId) return true
      const [row] = await db
        .select()
        .from(fileFolder)
        .where(eq(fileFolder.id, folderId))
      if (!row) return false
      return householdId
        ? row.organizationId === householdId
        : row.organizationId === null && row.userId === userId
    },

    async updateFile(
      fileId: string,
      changes: { name?: string; folderId?: string | null }
    ) {
      if (changes.name === undefined && changes.folderId === undefined) {
        const [row] = await db
          .select()
          .from(storedFile)
          .where(eq(storedFile.id, fileId))
        return row
      }
      const [row] = await db
        .update(storedFile)
        .set(changes)
        .where(eq(storedFile.id, fileId))
        .returning()
      return row
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
        folderId: string | null
      }
    ) {
      const id = randomUUID()
      const [row] = await db
        .insert(storedFile)
        .values({
          id,
          userId,
          organizationId: input.householdId,
          folderId: input.folderId,
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
