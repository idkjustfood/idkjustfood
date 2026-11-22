import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A note: plain text. It belongs to the user who made it and, when shared, to a household (a
 * Better Auth organization). Empty text means nothing was written.
 */
export const note = pgTable(
  "note",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal note. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("note_userId_idx").on(table.userId),
    index("note_organizationId_idx").on(table.organizationId),
  ]
)
