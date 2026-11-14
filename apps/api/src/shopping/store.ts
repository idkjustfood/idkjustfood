import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import type {
  ShoppingItemContent,
  ShoppingItemInput,
  ShoppingItemUpdate,
} from "@workspace/schemas"

import { householdStore } from "../households/store.js"

const { shoppingList, shoppingItem } = schema

export type ShoppingListRow = typeof shoppingList.$inferSelect
export type ShoppingItemRow = typeof shoppingItem.$inferSelect

/** Database queries for shopping lists. Who may see a list is decided in `access`. */
export function shoppingStore(db: Database) {
  const households = householdStore(db)

  /**
   * The list, if this user may see it: their own personal list, or a list of a
   * household they are in. `householdRole` is null for personal lists.
   */
  async function access(listId: string, userId: string) {
    const [row] = await db
      .select()
      .from(shoppingList)
      .where(eq(shoppingList.id, listId))
    if (!row) return undefined
    if (!row.organizationId) {
      return row.userId === userId ? { row, householdRole: null } : undefined
    }
    const membership = await households.membership(row.organizationId, userId)
    return membership ? { row, householdRole: membership.role } : undefined
  }

  async function itemsOf(listIds: string[]) {
    if (listIds.length === 0) return new Map<string, ShoppingItemRow[]>()
    const rows = await db
      .select()
      .from(shoppingItem)
      .where(inArray(shoppingItem.listId, listIds))
      .orderBy(asc(shoppingItem.createdAt), asc(shoppingItem.id))
    const byList = new Map<string, ShoppingItemRow[]>()
    for (const row of rows) {
      byList.set(row.listId, [...(byList.get(row.listId) ?? []), row])
    }
    return byList
  }

  function itemValues(input: ShoppingItemInput) {
    return {
      name: input.name,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      note: input.note ?? null,
    }
  }

  return {
    access,

    /** Every list the user may see: their personal lists and their households' lists. */
    async listForUser(userId: string) {
      const memberships = await households.listForUser(userId)
      const ids = memberships.map((m) => m.id)
      const rows = await db
        .select()
        .from(shoppingList)
        .where(
          or(
            and(
              isNull(shoppingList.organizationId),
              eq(shoppingList.userId, userId)
            ),
            ids.length > 0
              ? inArray(shoppingList.organizationId, ids)
              : undefined
          )
        )
        .orderBy(asc(shoppingList.createdAt), asc(shoppingList.id))
      const items = await itemsOf(rows.map((r) => r.id))
      return rows.map((row) => ({ row, items: items.get(row.id) ?? [] }))
    },

    async items(listId: string) {
      return (await itemsOf([listId])).get(listId) ?? []
    },

    /**
     * Makes a list. When the client chose an id that already exists, nothing
     * is made twice: the existing list is returned, so a retry is harmless.
     */
    async create(
      userId: string,
      householdId: string | null,
      name: string,
      id?: string
    ) {
      const listId = id ?? randomUUID()
      const [row] = await db
        .insert(shoppingList)
        .values({ id: listId, userId, organizationId: householdId, name })
        .onConflictDoNothing()
        .returning()
      return row ?? (await access(listId, userId))?.row
    },

    async rename(listId: string, name: string) {
      const [row] = await db
        .update(shoppingList)
        .set({ name })
        .where(eq(shoppingList.id, listId))
        .returning()
      return row
    },

    async remove(listId: string) {
      await db.delete(shoppingList).where(eq(shoppingList.id, listId))
    },

    /** Adds one item. An id that exists already is left alone (a retry). */
    async addItem(listId: string, input: ShoppingItemInput) {
      const id = input.id ?? randomUUID()
      const [row] = await db
        .insert(shoppingItem)
        .values({ id, listId, ...itemValues(input) })
        .onConflictDoNothing()
        .returning()
      if (row) return row
      const [existing] = await db
        .select()
        .from(shoppingItem)
        .where(and(eq(shoppingItem.id, id), eq(shoppingItem.listId, listId)))
      return existing
    },

    async updateItem(
      listId: string,
      itemId: string,
      change: ShoppingItemUpdate
    ) {
      const values = Object.fromEntries(
        Object.entries(change).filter(([, value]) => value !== undefined)
      )
      if (Object.keys(values).length === 0) {
        const [row] = await db
          .select()
          .from(shoppingItem)
          .where(
            and(eq(shoppingItem.id, itemId), eq(shoppingItem.listId, listId))
          )
        return row
      }
      const [row] = await db
        .update(shoppingItem)
        .set(values)
        .where(
          and(eq(shoppingItem.id, itemId), eq(shoppingItem.listId, listId))
        )
        .returning()
      return row
    },

    async removeItem(listId: string, itemId: string) {
      const rows = await db
        .delete(shoppingItem)
        .where(
          and(eq(shoppingItem.id, itemId), eq(shoppingItem.listId, listId))
        )
        .returning({ id: shoppingItem.id })
      return rows.length > 0
    },

    async clearChecked(listId: string) {
      await db
        .delete(shoppingItem)
        .where(
          and(eq(shoppingItem.listId, listId), eq(shoppingItem.checked, true))
        )
    },

    /**
     * Replaces the unticked items of a list. Used after merging a recipe in:
     * existing items are updated, new ones are added. Runs in one transaction,
     * so two people adding recipes at once do not lose each other's lines.
     */
    async saveMerged(
      listId: string,
      merge: (
        current: (ShoppingItemContent & { id: string })[]
      ) => ShoppingItemContent[]
    ) {
      await db.transaction(async (tx) => {
        // Lock the list so concurrent merges run one after another.
        await tx
          .select({ id: shoppingList.id })
          .from(shoppingList)
          .where(eq(shoppingList.id, listId))
          .for("update")
        const current = await tx
          .select()
          .from(shoppingItem)
          .where(eq(shoppingItem.listId, listId))
          .orderBy(asc(shoppingItem.createdAt), asc(shoppingItem.id))
        const merged = merge(current)
        // One transaction has one `now()`, so give new lines their own time to keep their order.
        const start = Date.now()
        for (const [index, item] of merged.entries()) {
          const existing = current[index]
          if (existing) {
            await tx
              .update(shoppingItem)
              .set({
                quantity: item.quantity,
                fromRecipes: item.fromRecipes,
              })
              .where(eq(shoppingItem.id, existing.id))
          } else {
            await tx.insert(shoppingItem).values({
              id: randomUUID(),
              listId,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              note: item.note,
              checked: false,
              fromRecipes: item.fromRecipes,
              createdAt: new Date(start + index),
            })
          }
        }
        await tx
          .update(shoppingList)
          .set({ updatedAt: new Date() })
          .where(eq(shoppingList.id, listId))
      })
    },
  }
}

export type ShoppingStore = ReturnType<typeof shoppingStore>
