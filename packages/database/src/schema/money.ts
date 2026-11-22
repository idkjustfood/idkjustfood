import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"
import { storedFile } from "./files.js"

/**
 * Money. Every table below belongs to the user who made the row and, when shared, to a
 * household (a Better Auth organization): `organizationId` null means personal. Amounts are
 * whole cents. Days (`YYYY-MM-DD`) are text on purpose: a bill or an expense is on a day, not at
 * a moment, so the server never needs a time zone.
 */

const owner = {
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Null means personal. */
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
}

/** The currency of a space. Its id is `household id`, or `u:<user id>` for a person's own money. */
export const moneySettings = pgTable("money_settings", {
  id: text("id").primaryKey(),
  ...owner,
  currency: text("currency").notNull(),
  /** Whether the built-in categories were added, so deleting one never brings it back. */
  categoriesSeeded: boolean("categories_seeded").notNull().default(false),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * An expense category. `key` is set for the built-in ones (the app shows their name in the
 * person's language), `name` for ones the person made or renamed.
 */
export const moneyCategory = pgTable(
  "money_category",
  {
    id: text("id").primaryKey(),
    ...owner,
    key: text("key"),
    name: text("name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("money_category_userId_idx").on(table.userId),
    index("money_category_organizationId_idx").on(table.organizationId),
  ]
)

export const moneyExpense = pgTable(
  "money_expense",
  {
    id: text("id").primaryKey(),
    ...owner,
    amountCents: integer("amount_cents").notNull(),
    categoryId: text("category_id").references(() => moneyCategory.id, {
      onDelete: "set null",
    }),
    date: text("date").notNull(),
    note: text("note").notNull().default(""),
    /** Who paid. */
    paidBy: text("paid_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    billId: text("bill_id").references(() => moneyBill.id, {
      onDelete: "set null",
    }),
    receiptId: text("receipt_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("money_expense_userId_idx").on(table.userId),
    index("money_expense_organizationId_idx").on(table.organizationId),
    index("money_expense_date_idx").on(table.date),
  ]
)

/** A monthly budget for one category, or in total when `categoryId` is null. */
export const moneyBudget = pgTable(
  "money_budget",
  {
    id: text("id").primaryKey(),
    ...owner,
    categoryId: text("category_id").references(() => moneyCategory.id, {
      onDelete: "cascade",
    }),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("money_budget_userId_idx").on(table.userId),
    index("money_budget_organizationId_idx").on(table.organizationId),
  ]
)

/** A bill that comes back (or not). `nextDue` is null once a bill that does not repeat was paid. */
export const moneyBill = pgTable(
  "money_bill",
  {
    id: text("id").primaryKey(),
    ...owner,
    title: text("title").notNull(),
    amountCents: integer("amount_cents").notNull(),
    categoryId: text("category_id").references(() => moneyCategory.id, {
      onDelete: "set null",
    }),
    repeat: text("repeat").notNull(),
    nextDue: text("next_due"),
    dayOfMonth: integer("day_of_month").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("money_bill_userId_idx").on(table.userId),
    index("money_bill_organizationId_idx").on(table.organizationId),
  ]
)

export const moneySavingsGoal = pgTable(
  "money_savings_goal",
  {
    id: text("id").primaryKey(),
    ...owner,
    name: text("name").notNull(),
    targetCents: integer("target_cents").notNull(),
    targetDate: text("target_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("money_savings_goal_userId_idx").on(table.userId),
    index("money_savings_goal_organizationId_idx").on(table.organizationId),
  ]
)

/** Money put into (positive) or taken out of (negative) a savings goal. */
export const moneySavingsEntry = pgTable(
  "money_savings_entry",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => moneySavingsGoal.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    date: text("date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("money_savings_entry_goalId_idx").on(table.goalId)]
)

/** A photographed receipt. The values are what the AI read, corrected by the person. */
export const moneyReceipt = pgTable(
  "money_receipt",
  {
    id: text("id").primaryKey(),
    ...owner,
    fileId: text("file_id").references(() => storedFile.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull(),
    shop: text("shop"),
    date: text("date"),
    totalCents: integer("total_cents"),
    expenseId: text("expense_id"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("money_receipt_userId_idx").on(table.userId),
    index("money_receipt_organizationId_idx").on(table.organizationId),
  ]
)
