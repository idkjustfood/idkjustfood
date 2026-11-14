import { sql } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A shopping list. It belongs to the user who made it and, when shared, to a
 * household (a Better Auth organization). Without a household, only its owner sees it.
 */
export const shoppingList = pgTable(
  "shopping_list",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal list. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("shopping_list_userId_idx").on(table.userId),
    index("shopping_list_organizationId_idx").on(table.organizationId),
  ]
)

/** One line on a shopping list. The quantity is null when nobody said how much. */
export const shoppingItem = pgTable(
  "shopping_item",
  {
    id: text("id").primaryKey(),
    listId: text("list_id")
      .notNull()
      .references(() => shoppingList.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: doublePrecision("quantity"),
    unit: text("unit"),
    note: text("note"),
    checked: boolean("checked").notNull().default(false),
    /** Titles of the recipes this item came from. */
    fromRecipes: text("from_recipes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("shopping_item_listId_idx").on(table.listId)]
)
