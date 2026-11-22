import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A to-do task. It belongs to the user who made it and, when shared, to a household (a Better
 * Auth organization). `due_date` is a calendar day (`YYYY-MM-DD`) kept as text on purpose: a task
 * is due on a day, not at a moment, so the server never needs a time zone.
 */
export const task = pgTable(
  "task",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal task. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    /** The household member the task is assigned to. Null when nobody is. */
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    dueDate: text("due_date"),
    doneAt: timestamp("done_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_userId_idx").on(table.userId),
    index("task_organizationId_idx").on(table.organizationId),
    index("task_dueDate_idx").on(table.dueDate),
  ]
)
