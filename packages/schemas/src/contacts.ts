import { z } from "zod"

/**
 * Contacts: the numbers a household needs at hand (craftspeople, doctors, school). A contact is
 * personal or belongs to a household, like shopping lists and chores.
 *
 * Everything but the name is optional text. Empty means nothing was written down.
 */

const name = z.string().trim().min(1).max(200)
const role = z.string().trim().max(200)
const phone = z.string().trim().max(50)
const email = z
  .string()
  .trim()
  .max(200)
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+$/.test(value), {
    message: "Not an email address",
  })
const note = z.string().trim().max(2000)

export const ContactSchema = z.object({
  id: z.string(),
  name,
  /** What the person does: plumber, dentist, class teacher. */
  role,
  phone,
  email,
  note,
  /** The household the contact belongs to, or null for the person's own contact. */
  householdId: z.string().nullable(),
  createdAt: z.string(),
})
export type Contact = z.infer<typeof ContactSchema>

/** What a client sends to add a contact. The client may choose the `id`, so a retry adds nothing twice. */
export const ContactInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name,
  role: role.optional(),
  phone: phone.optional(),
  email: email.optional(),
  note: note.optional(),
  /** Empty (null) means a personal contact. */
  householdId: z.string().nullable().optional(),
})
export type ContactInput = z.infer<typeof ContactInputSchema>

export const ContactUpdateSchema = z.object({
  name: name.optional(),
  role: role.optional(),
  phone: phone.optional(),
  email: email.optional(),
  note: note.optional(),
})
export type ContactUpdate = z.infer<typeof ContactUpdateSchema>

/** Contacts whose name, role, phone, email or note contain every word typed. */
export function searchContacts<
  T extends Pick<Contact, "name" | "role" | "phone" | "email" | "note">,
>(contacts: readonly T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...contacts]
  return contacts.filter((contact) => {
    const text =
      `${contact.name} ${contact.role} ${contact.phone} ${contact.email} ${contact.note}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

/** A phone number as a `tel:` link target: digits and a leading plus only. */
export function phoneHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "")
  return /\d/.test(digits) ? `tel:${digits}` : null
}
