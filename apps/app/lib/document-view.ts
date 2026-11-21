/**
 * Pure helpers for the documents screen. No i18n here: they return keys and numbers, the
 * screen turns them into text.
 */

export type DocumentKind = "pdf" | "image" | "text" | "other"

/** What kind of file it is, for its icon. */
export function documentKind(mimeType: string): DocumentKind {
  const type = mimeType.toLowerCase()
  if (type === "application/pdf") return "pdf"
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("text/")) return "text"
  return "other"
}

export type SizeUnit = "bytes" | "kb" | "mb" | "gb"

/** A file size as a number and a unit key, for example 1.5 MB. Uses 1024 steps. */
export function sizeParts(bytes: number): { value: number; unit: SizeUnit } {
  const steps: SizeUnit[] = ["bytes", "kb", "mb", "gb"]
  let value = Math.max(0, bytes)
  let index = 0
  while (value >= 1024 && index < steps.length - 1) {
    value /= 1024
    index++
  }
  // One decimal from KB up, rounded; whole bytes stay whole.
  const rounded = index === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return { value: rounded, unit: steps[index]! }
}

/** A name that is safe to use for a file in the phone's cache folder. */
export function cacheFileName(id: string, name: string) {
  const safe = name.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/^\.+/, "_")
  return `${id}-${safe.slice(0, 100)}`
}

/** Whether the person may delete a document: their own, or any in a household they run. */
export function mayDeleteDocument(
  file: { uploadedBy: string; householdId: string | null },
  userId: string,
  role: string | undefined
) {
  if (!file.householdId) return file.uploadedBy === userId
  if (file.uploadedBy === userId) return true
  return (
    !!role && role.split(",").some((r) => ["owner", "admin"].includes(r.trim()))
  )
}

export type FolderColor =
  "rose" | "sage" | "peach" | "lavender" | "butter" | "sky"

/** The colours a folder can have, in the order they are offered. */
export const folderColors: FolderColor[] = [
  "rose",
  "sage",
  "peach",
  "lavender",
  "butter",
  "sky",
]

/** Theme token classes per folder colour. Written out in full so Tailwind finds them. */
export const folderToneClasses: Record<
  FolderColor,
  { background: string; icon: string }
> = {
  rose: { background: "bg-tone-rose", icon: "text-tone-rose-foreground" },
  sage: { background: "bg-tone-sage", icon: "text-tone-sage-foreground" },
  peach: { background: "bg-tone-peach", icon: "text-tone-peach-foreground" },
  lavender: {
    background: "bg-tone-lavender",
    icon: "text-tone-lavender-foreground",
  },
  butter: { background: "bg-tone-butter", icon: "text-tone-butter-foreground" },
  sky: { background: "bg-tone-sky", icon: "text-tone-sky-foreground" },
}

/** The name offered in the upload dialog: the file's own name, which keeps its extension. */
export function suggestedName(fileName: string) {
  return fileName.trim()
}

/** Whether a name can be saved: it needs at least one character that is not a space. */
export function isValidName(name: string) {
  return name.trim().length > 0
}

/** Folders by name, ignoring case, so the list does not jump around. */
export function sortFolders<T extends { name: string }>(folders: T[]) {
  return [...folders].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  )
}

/** The files that are directly in a folder, or in the root when `folderId` is null. */
export function filesInFolder<T extends { folderId: string | null }>(
  files: T[],
  folderId: string | null
) {
  return files.filter((file) => file.folderId === folderId)
}
