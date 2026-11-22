import { z } from "zod"

/**
 * Home inventory: what the household owns and where it is kept ("3 candles, kitchen drawer").
 * An item is personal or belongs to a household, like shopping lists and chores.
 *
 * `place` and `note` are plain text. Empty means nothing was written: nothing is guessed.
 */

export const MAX_INVENTORY_QUANTITY = 9999

const name = z.string().trim().min(1).max(200)
const place = z.string().trim().max(200)
const note = z.string().trim().max(2000)
const quantity = z.number().int().min(1).max(MAX_INVENTORY_QUANTITY)

export const InventoryItemSchema = z.object({
  id: z.string(),
  name,
  /** Where it is kept (a room, a box, a shelf). Empty when not written down. */
  place,
  quantity,
  note,
  /** The household the item belongs to, or null for the person's own item. */
  householdId: z.string().nullable(),
  createdAt: z.string(),
})
export type InventoryItem = z.infer<typeof InventoryItemSchema>

/** What a client sends to add an item. The client may choose the `id`, so a retry adds nothing twice. */
export const InventoryItemInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name,
  place: place.optional(),
  quantity: quantity.optional(),
  note: note.optional(),
  /** Empty (null) means a personal item. */
  householdId: z.string().nullable().optional(),
})
export type InventoryItemInput = z.infer<typeof InventoryItemInputSchema>

export const InventoryItemUpdateSchema = z.object({
  name: name.optional(),
  place: place.optional(),
  quantity: quantity.optional(),
  note: note.optional(),
})
export type InventoryItemUpdate = z.infer<typeof InventoryItemUpdateSchema>

/** Items whose name, place or note contain every word typed. */
export function searchInventory<
  T extends Pick<InventoryItem, "name" | "place" | "note">,
>(items: readonly T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...items]
  return items.filter((item) => {
    const text = `${item.name} ${item.place} ${item.note}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}
