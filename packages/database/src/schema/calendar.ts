import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A calendar entry: a title and a colour on a day. It belongs to the user who made it and,
 * when shared, to a household (a Better Auth organization).
 *
 * `date` is a calendar day (`YYYY-MM-DD`), kept as text on purpose: an entry is on a day, not at
 * a moment, so the server never needs to know a time zone. `color` is the name of a design
 * token (`rose`, `sage`, ...), not a colour value.
 */
export const calendarEntry = pgTable(
  "calendar_entry",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal entry. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    color: text("color").notNull(),
    date: text("date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("calendar_entry_userId_idx").on(table.userId),
    index("calendar_entry_organizationId_idx").on(table.organizationId),
    index("calendar_entry_date_idx").on(table.date),
  ]
)
