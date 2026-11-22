import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A contact: a craftsperson, doctor or school the household needs at hand. It belongs to the user who made it and, when shared, to a household (a Better Auth
 * organization). Empty text means nothing was written down.
 */
export const contact = pgTable(
  "contact",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal contact. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("contact_userId_idx").on(table.userId),
    index("contact_organizationId_idx").on(table.organizationId),
  ]
)
