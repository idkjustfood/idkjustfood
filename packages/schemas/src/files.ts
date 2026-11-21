import { z } from "zod"

/**
 * Files (documents): warranties, contracts, scans. A file is stored on the server's own disk
 * and belongs either to one person or to one household.
 */

export const StoredFileSchema = z.object({
  id: z.string(),
  /** The name of the file as the person knows it, for example "Dishwasher warranty.pdf". */
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  /** The household it is shared with, or null for the person's own file. */
  householdId: z.string().nullable(),
  /** The user who uploaded it. */
  uploadedBy: z.string(),
  createdAt: z.string(),
})
export type StoredFile = z.infer<typeof StoredFileSchema>

/** Types a server accepts unless its owner sets `FILES_ALLOWED_TYPES`. `image/*` means any image. */
export const DEFAULT_ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/*",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]

/** The size limit in megabytes unless its owner sets `FILES_MAX_MB`. */
export const DEFAULT_MAX_FILE_MB = 25

/** Whether `mimeType` is allowed by a list that may hold wildcards like `image/*`. */
export function isAllowedFileType(mimeType: string, allowed: string[]) {
  const type = mimeType.split(";")[0]?.trim().toLowerCase() ?? ""
  if (!type) return false
  return allowed.some((rule) => {
    const wanted = rule.trim().toLowerCase()
    return wanted.endsWith("/*")
      ? type.startsWith(wanted.slice(0, -1))
      : type === wanted
  })
}
