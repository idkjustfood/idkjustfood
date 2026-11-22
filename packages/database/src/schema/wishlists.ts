import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A person a wishlist is kept for ("Mia", "Grandpa"). Personal, or shared with a household (a
 * Better Auth organization).
 */
export const wishPerson = pgTable(
  "wish_person",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means the person belongs to the user's own wishlists. */
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
    index("wish_person_userId_idx").on(table.userId),
    index("wish_person_organizationId_idx").on(table.organizationId),
  ]
)

/** A wish. It sits under a person, or at the root when `personId` is null. */
export const wish = pgTable(
  "wish",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    /** Null means a wish at the root. Deleting the person deletes their wishes. */
    personId: text("person_id").references(() => wishPerson.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    link: text("link").notNull().default(""),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("wish_userId_idx").on(table.userId),
    index("wish_organizationId_idx").on(table.organizationId),
    index("wish_personId_idx").on(table.personId),
  ]
)
