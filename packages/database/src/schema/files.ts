import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A folder for documents. Like a file, it is personal or shared with one household. Folders are
 * one level deep.
 */
export const fileFolder = pgTable(
  "file_folder",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal folder. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    /** A theme tone name (see `FOLDER_COLORS`), or null for the default look. */
    color: text("color"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("file_folder_userId_idx").on(table.userId),
    index("file_folder_organizationId_idx").on(table.organizationId),
  ]
)

/**
 * A stored file (a document). Only the details live here; the bytes are on the server's own
 * disk, under `storageKey`. A file belongs to the user who uploaded it and, when shared, to a
 * household (a Better Auth organization).
 */
export const storedFile = pgTable(
  "stored_file",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal file. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    /** The folder it is in. Null means the root. Deleting a folder deletes its files. */
    folderId: text("folder_id").references(() => fileFolder.id, {
      onDelete: "cascade",
    }),
    /** The name the person gave it. Never used as a path on disk. */
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    /** The generated name of the file inside the storage folder. */
    storageKey: text("storage_key").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("stored_file_userId_idx").on(table.userId),
    index("stored_file_organizationId_idx").on(table.organizationId),
    index("stored_file_folderId_idx").on(table.folderId),
  ]
)
