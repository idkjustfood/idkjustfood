import type { UnitKey } from "@workspace/schemas"
import { sql } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
    unit: text("unit").$type<UnitKey>(),
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

/**
 * The pantry of a person or a household: the things they always have at home. One row per
 * space, made the first time it is needed. A pantry without items is a pantry the person
 * emptied on purpose, so the row (not the items) says that the default list was given.
 */
export const pantry = pgTable(
  "pantry",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means the person's own pantry. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pantry_organizationId_idx").on(table.organizationId),
    uniqueIndex("pantry_personal_userId_idx")
      .on(table.userId)
      .where(sql`${table.organizationId} is null`),
  ]
)

/** One staple. `key` is the name in a form that ignores case and extra spaces. */
export const pantryItem = pgTable(
  "pantry_item",
  {
    id: text("id").primaryKey(),
    pantryId: text("pantry_id")
      .notNull()
      .references(() => pantry.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pantry_item_pantryId_key_idx").on(table.pantryId, table.key),
  ]
)
