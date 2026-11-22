import { z } from "zod"

/**
 * Wishlists: wishes, grouped per person ("Mia", "Grandpa"). A wish can also sit at the root,
 * without a person. People and wishes are personal or belong to a household, like contacts.
 */

const name = z.string().trim().min(1).max(200)
const title = z.string().trim().min(1).max(300)
const note = z.string().trim().max(2000)
const link = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), {
    message: "Not a web link",
  })

export const WishPersonSchema = z.object({
  id: z.string(),
  name,
  /** The household the person's list belongs to, or null for the user's own. */
  householdId: z.string().nullable(),
  createdAt: z.string(),
})
export type WishPerson = z.infer<typeof WishPersonSchema>

export const WishPersonInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name,
  householdId: z.string().nullable().optional(),
})
export type WishPersonInput = z.infer<typeof WishPersonInputSchema>

export const WishPersonUpdateSchema = z.object({ name: name.optional() })
export type WishPersonUpdate = z.infer<typeof WishPersonUpdateSchema>

export const WishSchema = z.object({
  id: z.string(),
  title,
  note,
  /** A web link to the thing, or empty. */
  link,
  /** Whether the wish is fulfilled (bought, given). */
  done: z.boolean(),
  /** The person the wish is for, or null for a wish at the root. */
  personId: z.string().nullable(),
  householdId: z.string().nullable(),
  createdAt: z.string(),
})
export type Wish = z.infer<typeof WishSchema>

export const WishInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title,
  note: note.optional(),
  link: link.optional(),
  done: z.boolean().optional(),
  /** Empty (null) means a wish at the root. Must belong to the same space as the wish. */
  personId: z.string().nullable().optional(),
  householdId: z.string().nullable().optional(),
})
export type WishInput = z.infer<typeof WishInputSchema>

export const WishUpdateSchema = z.object({
  title: title.optional(),
  note: note.optional(),
  link: link.optional(),
  done: z.boolean().optional(),
  /** Moves the wish to a person, or to the root with null. */
  personId: z.string().nullable().optional(),
})
export type WishUpdate = z.infer<typeof WishUpdateSchema>

/** Wishes whose title, note or link contain every word typed. */
export function searchWishes<T extends Pick<Wish, "title" | "note" | "link">>(
  wishes: readonly T[],
  query: string
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...wishes]
  return wishes.filter((wish) => {
    const text = `${wish.title} ${wish.note} ${wish.link}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

/** Open wishes first, fulfilled ones last. Keeps the order inside each group. */
export function openWishesFirst<T extends Pick<Wish, "done">>(wishes: readonly T[]): T[] {
  return [...wishes.filter((w) => !w.done), ...wishes.filter((w) => w.done)]
}
