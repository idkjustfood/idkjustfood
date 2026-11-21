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
