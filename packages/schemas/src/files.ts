import { z } from "zod"

/**
 * Files (documents): contracts, scans, receipts. A file is stored on the server's own disk
 * and belongs either to one person or to one household. Files can be sorted into folders.
 */

/** The colours a folder can have. They are the pastel tones of the app theme. */
export const FOLDER_COLORS = [
  "rose",
  "sage",
  "peach",
  "lavender",
  "butter",
  "sky",
] as const
export const FolderColorSchema = z.enum(FOLDER_COLORS)
export type FolderColor = z.infer<typeof FolderColorSchema>

export const FileNameSchema = z.string().trim().min(1).max(200)

export const FolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Null means the default look. */
  color: FolderColorSchema.nullable(),
  householdId: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
})
export type Folder = z.infer<typeof FolderSchema>

export const FolderInputSchema = z.object({
  name: FileNameSchema,
  color: FolderColorSchema.nullable().optional(),
  householdId: z.string().optional(),
})

export const FolderUpdateSchema = z.object({
  name: FileNameSchema.optional(),
  color: FolderColorSchema.nullable().optional(),
})

export const FileUpdateSchema = z.object({
  name: FileNameSchema.optional(),
  /** Move the file into a folder, or to the root with null. */
  folderId: z.string().nullable().optional(),
})

export const StoredFileSchema = z.object({
  id: z.string(),
  /** The name of the file as the person knows it, for example "Rental contract.pdf". */
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  /** The household it is shared with, or null for the person's own file. */
  householdId: z.string().nullable(),
  /** The folder it is in, or null when it is in the root. */
  folderId: z.string().nullable(),
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
