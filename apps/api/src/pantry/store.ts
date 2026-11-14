import { randomUUID } from "node:crypto"
import { and, asc, eq, isNull } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import {
  defaultPantry,
  pantryKey,
  type RecipeLanguage,
} from "@workspace/schemas"

import { householdStore } from "../households/store.js"

const { pantry, pantryItem } = schema

export type PantryRow = typeof pantry.$inferSelect
export type PantryItemRow = typeof pantryItem.$inferSelect

/** Database queries for pantry staples. Who may use a pantry is decided in `access`. */
export function pantryStore(db: Database) {
  const households = householdStore(db)

  async function items(pantryId: string) {
    return db
      .select()
      .from(pantryItem)
      .where(eq(pantryItem.pantryId, pantryId))
      .orderBy(asc(pantryItem.createdAt), asc(pantryItem.id))
  }

  /** Puts the default list of a language into a pantry. Names already there are kept. */
  function seed(
    executor: Database,
    pantryId: string,
    language?: RecipeLanguage
  ) {
    // Each item gets its own time, so the list keeps the order of the default list.
    const start = Date.now()
    return executor
      .insert(pantryItem)
      .values(
        defaultPantry(language).map((name, index) => ({
          id: randomUUID(),
          pantryId,
          name,
          key: pantryKey(name),
          createdAt: new Date(start + index),
        }))
      )
      .onConflictDoNothing()
  }

  return {
    items,

    /**
     * The pantry of a person (`householdId` null) or of a household they are in, or
     * undefined when they are not a member. A pantry that does not exist yet is made
     * with the default list of `language`, so every space starts with one.
     */
    async access(
      userId: string,
      householdId: string | null,
      language?: RecipeLanguage
    ) {
      if (householdId && !(await households.membership(householdId, userId))) {
        return undefined
      }
      const find = async () => {
        const [row] = await db
          .select()
          .from(pantry)
          .where(
            householdId
              ? eq(pantry.organizationId, householdId)
              : and(eq(pantry.userId, userId), isNull(pantry.organizationId))
          )
        return row
      }
      const existing = await find()
      if (existing) return existing
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(pantry)
          .values({ id: randomUUID(), userId, organizationId: householdId })
          .onConflictDoNothing()
          .returning()
        if (created) await seed(tx as unknown as Database, created.id, language)
        return created ?? (await find())
      })
    },

    /** The pantry an item is in, if the user may use it. */
    async accessItem(userId: string, itemId: string) {
      const [row] = await db
        .select({ pantry })
        .from(pantryItem)
        .innerJoin(pantry, eq(pantryItem.pantryId, pantry.id))
        .where(eq(pantryItem.id, itemId))
      if (!row) return undefined
      const { pantry: found } = row
      if (found.organizationId) {
        const membership = await households.membership(
          found.organizationId,
          userId
        )
        return membership ? found : undefined
      }
      return found.userId === userId ? found : undefined
    },

    /** Adds a staple. A name that is already there (or a repeated id) returns the existing one. */
    async addItem(pantryId: string, name: string, id?: string) {
      const key = pantryKey(name)
      const [row] = await db
        .insert(pantryItem)
        .values({ id: id ?? randomUUID(), pantryId, name: name.trim(), key })
        .onConflictDoNothing()
        .returning()
      if (row) return row
      const [existing] = await db
        .select()
        .from(pantryItem)
        .where(and(eq(pantryItem.pantryId, pantryId), eq(pantryItem.key, key)))
      return existing
    },

    async removeItem(pantryId: string, itemId: string) {
      const rows = await db
        .delete(pantryItem)
        .where(
          and(eq(pantryItem.id, itemId), eq(pantryItem.pantryId, pantryId))
        )
        .returning({ id: pantryItem.id })
      return rows.length > 0
    },

    /** Replaces the whole list with the default one. Added items are removed. */
    async reset(pantryId: string, language?: RecipeLanguage) {
      await db.transaction(async (tx) => {
        await tx.delete(pantryItem).where(eq(pantryItem.pantryId, pantryId))
        await seed(tx as unknown as Database, pantryId, language)
      })
    },
  }
}

export type PantryStore = ReturnType<typeof pantryStore>
