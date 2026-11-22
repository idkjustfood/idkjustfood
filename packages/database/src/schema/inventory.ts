import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * An item in the home inventory: what the household owns and where it is kept. It belongs to the user who made it and, when shared, to a household (a Better Auth
 * organization). Empty text means nothing was written down.
 */
export const inventoryItem = pgTable(
  "inventory_item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal item. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    place: text("place").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("inventory_item_userId_idx").on(table.userId),
    index("inventory_item_organizationId_idx").on(table.organizationId),
  ]
)
