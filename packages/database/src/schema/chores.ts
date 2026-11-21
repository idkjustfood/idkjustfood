import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A household chore: a task that comes back every `intervalDays` days. It belongs to the user
 * who made it and, when shared, to a household (a Better Auth organization).
 *
 * `lastDoneOn` is a calendar day (`YYYY-MM-DD`) in the time zone of the person who checked it,
 * kept as text on purpose: the server never needs to know a time zone, because a chore is due
 * again on a day, not at a moment.
 */
export const chore = pgTable(
  "chore",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal chore. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    intervalDays: integer("interval_days").notNull(),
    lastDoneOn: text("last_done_on"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chore_userId_idx").on(table.userId),
    index("chore_organizationId_idx").on(table.organizationId),
  ]
)
