import { z } from "zod"

/**
 * Notes: plain text a person or household wants to keep. A note is personal or belongs to a
 * household, like contacts. It has an optional title and a body; at least one must be filled in.
 */

const title = z.string().trim().max(200)
const body = z.string().max(20000)

export const NoteSchema = z.object({
  id: z.string(),
  title,
  body,
  /** The household the note belongs to, or null for the person's own note. */
  householdId: z.string().nullable(),
  createdAt: z.string(),
})
export type Note = z.infer<typeof NoteSchema>

const hasText = (note: { title?: string; body?: string }) =>
  (note.title ?? "").trim() !== "" || (note.body ?? "").trim() !== ""

/** What a client sends to add a note. The client may choose the `id`, so a retry adds nothing twice. */
export const NoteInputSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    title: title.optional(),
    body: body.optional(),
    /** Empty (null) means a personal note. */
    householdId: z.string().nullable().optional(),
  })
  .refine(hasText, { message: "A note needs a title or some text" })
export type NoteInput = z.infer<typeof NoteInputSchema>

export const NoteUpdateSchema = z.object({
  title: title.optional(),
  body: body.optional(),
})
export type NoteUpdate = z.infer<typeof NoteUpdateSchema>

/** Notes whose title or text contain every word typed. */
export function searchNotes<T extends Pick<Note, "title" | "body">>(
  notes: readonly T[],
  query: string
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...notes]
  return notes.filter((note) => {
    const text = `${note.title} ${note.body}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

/** The first line with text, to show a note that has no title. */
export function noteHeading(note: Pick<Note, "title" | "body">): string {
  if (note.title.trim()) return note.title.trim()
  return note.body.split("\n").find((line) => line.trim() !== "")?.trim() ?? ""
}
