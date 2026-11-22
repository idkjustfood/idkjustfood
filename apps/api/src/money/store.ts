import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import { schema, type Database } from "@workspace/database"
import {
  defaultCategoryKeys,
  defaultCurrency,
  dueAfterPaying,
  type BillInput,
  type BillPay,
  type BillRepeat,
  type BillUpdate,
  type BudgetInput,
  type Currency,
  type ExpenseInput,
  type ExpenseUpdate,
  type MoneyCategoryInput,
  type SavingsEntryInput,
  type SavingsGoalInput,
  type SavingsGoalUpdate,
} from "@workspace/schemas"

import { householdStore } from "../households/store.js"

const {
  moneySettings,
  moneyCategory,
  moneyExpense,
  moneyBudget,
  moneyBill,
  moneySavingsGoal,
  moneySavingsEntry,
  moneyReceipt,
} = schema

export type ExpenseRow = typeof moneyExpense.$inferSelect
export type BudgetRow = typeof moneyBudget.$inferSelect
export type CategoryRow = typeof moneyCategory.$inferSelect
export type BillRow = Omit<typeof moneyBill.$inferSelect, "repeat"> & {
  repeat: BillRepeat
}
export type GoalRow = typeof moneySavingsGoal.$inferSelect
export type SavingsEntryRow = typeof moneySavingsEntry.$inferSelect
export type ReceiptRow = typeof moneyReceipt.$inferSelect

/** Anything with an owner: personal when `organizationId` is null. */
type Owned = { userId: string; organizationId: string | null }

/** The id of a space: the household's id, or `u:<user id>` for a person's own money. */
export const spaceKey = (userId: string, householdId: string | null) =>
  householdId ?? `u:${userId}`

/**
 * Database queries for money. Who may see a row is decided here: a personal row is only for its
 * owner, a household row for every member. A person who leaves a household loses access.
 */
export function moneyStore(db: Database) {
  const households = householdStore(db)

  /** Where a user may see rows: their own personal ones and the ones of their households. */
  async function visibleTo(
    userId: string,
    table: { userId: AnyPgColumn; organizationId: AnyPgColumn }
  ) {
    const ids = (await households.listForUser(userId)).map((m) => m.id)
    return or(
      and(isNull(table.organizationId), eq(table.userId, userId)),
      ids.length > 0 ? inArray(table.organizationId, ids) : undefined
    )
  }

  /** Whether the user may see something owned by this space. */
  async function mayAccess(row: Owned, userId: string) {
    if (!row.organizationId) return row.userId === userId
    return !!(await households.membership(row.organizationId, userId))
  }

  return {
    /** Whether the user may add rows to this space (their own, or a household they are in). */
    async mayUse(userId: string, householdId: string | null) {
      if (!householdId) return true
      return !!(await households.membership(householdId, userId))
    },

    /** Whether `paidBy` can have paid in this space: the person themselves, or a household member. */
    async mayPay(householdId: string | null, userId: string, paidBy: string) {
      if (!householdId) return paidBy === userId
      return !!(await households.membership(householdId, paidBy))
    },

    mayAccess,

    // -- settings -----------------------------------------------------------

    async settingsFor(userId: string) {
      const rows = await db
        .select()
        .from(moneySettings)
        .where(await visibleTo(userId, moneySettings))
      const spaces = [
        { householdId: null as string | null },
        ...(await households.listForUser(userId)).map((m) => ({
          householdId: m.id as string | null,
        })),
      ]
      return spaces.map((space) => {
        const row = rows.find((r) => r.id === spaceKey(userId, space.householdId))
        return {
          householdId: space.householdId,
          currency: (row?.currency ?? defaultCurrency) as Currency,
        }
      })
    },

    async setCurrency(userId: string, householdId: string | null, currency: Currency) {
      await db
        .insert(moneySettings)
        .values({
          id: spaceKey(userId, householdId),
          userId,
          organizationId: householdId,
          currency,
        })
        .onConflictDoUpdate({
          target: moneySettings.id,
          set: { currency },
        })
    },

    // -- categories ---------------------------------------------------------

    /**
     * Gives every space the user can see its built-in categories the first time. The ids are
     * made from the space and the key, so two requests at once cannot add them twice.
     */
    async ensureCategories(userId: string) {
      const spaces = [
        { householdId: null as string | null },
        ...(await households.listForUser(userId)).map((m) => ({
          householdId: m.id as string | null,
        })),
      ]
      for (const space of spaces) {
        const key = spaceKey(userId, space.householdId)
        const [settings] = await db
          .select({ seeded: moneySettings.categoriesSeeded })
          .from(moneySettings)
          .where(eq(moneySettings.id, key))
        if (settings?.seeded) continue
        await db
          .insert(moneyCategory)
          .values(
            defaultCategoryKeys.map((categoryKey) => ({
              id: `${key}:${categoryKey}`,
              userId,
              organizationId: space.householdId,
              key: categoryKey,
              name: null,
            }))
          )
          .onConflictDoNothing()
        await db
          .insert(moneySettings)
          .values({
            id: key,
            userId,
            organizationId: space.householdId,
            currency: defaultCurrency,
            categoriesSeeded: true,
          })
          .onConflictDoUpdate({
            target: moneySettings.id,
            set: { categoriesSeeded: true },
          })
      }
    },

    async categories(userId: string) {
      return db
        .select()
        .from(moneyCategory)
        .where(await visibleTo(userId, moneyCategory))
        .orderBy(asc(moneyCategory.createdAt), asc(moneyCategory.id))
    },

    async category(categoryId: string, userId: string) {
      const [row] = await db
        .select()
        .from(moneyCategory)
        .where(eq(moneyCategory.id, categoryId))
      return row && (await mayAccess(row, userId)) ? row : undefined
    },

    /** Whether a category exists in the given space (so rows never use another space's category). */
    async categoryInSpace(categoryId: string, userId: string, householdId: string | null) {
      const row = await this.category(categoryId, userId)
      return !!row && row.organizationId === householdId
    },

    async createCategory(userId: string, input: MoneyCategoryInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(moneyCategory)
        .values({
          id,
          userId,
          organizationId: input.householdId ?? null,
          key: null,
          name: input.name,
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created }
      const existing = await this.category(id, userId)
      return existing ? { row: existing } : { conflict: true as const }
    },

    async renameCategory(categoryId: string, name: string) {
      const [row] = await db
        .update(moneyCategory)
        .set({ name })
        .where(eq(moneyCategory.id, categoryId))
        .returning()
      return row
    },

    async removeCategory(categoryId: string) {
      const rows = await db
        .delete(moneyCategory)
        .where(eq(moneyCategory.id, categoryId))
        .returning({ id: moneyCategory.id })
      return rows.length > 0
    },

    // -- expenses -----------------------------------------------------------

    async expenses(userId: string) {
      return db
        .select()
        .from(moneyExpense)
        .where(await visibleTo(userId, moneyExpense))
        .orderBy(
          asc(moneyExpense.date),
          asc(moneyExpense.createdAt),
          asc(moneyExpense.id)
        )
    },

    async expense(expenseId: string, userId: string) {
      const [row] = await db
        .select()
        .from(moneyExpense)
        .where(eq(moneyExpense.id, expenseId))
      return row && (await mayAccess(row, userId)) ? row : undefined
    },

    async createExpense(userId: string, input: ExpenseInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(moneyExpense)
        .values({
          id,
          userId,
          organizationId: input.householdId ?? null,
          amountCents: input.amountCents,
          categoryId: input.categoryId ?? null,
          date: input.date,
          note: input.note ?? "",
          paidBy: input.paidBy ?? userId,
          receiptId: input.receiptId ?? null,
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created }
      const existing = await this.expense(id, userId)
      return existing ? { row: existing } : { conflict: true as const }
    },

    async updateExpense(expenseId: string, change: ExpenseUpdate) {
      const [row] = await db
        .update(moneyExpense)
        .set({
          ...(change.amountCents !== undefined && { amountCents: change.amountCents }),
          ...(change.categoryId !== undefined && { categoryId: change.categoryId }),
          ...(change.date !== undefined && { date: change.date }),
          ...(change.note !== undefined && { note: change.note }),
          ...(change.paidBy !== undefined && { paidBy: change.paidBy }),
        })
        .where(eq(moneyExpense.id, expenseId))
        .returning()
      return row
    },

    async removeExpense(expenseId: string) {
      const rows = await db
        .delete(moneyExpense)
        .where(eq(moneyExpense.id, expenseId))
        .returning({ id: moneyExpense.id })
      return rows.length > 0
    },

    // -- budgets ------------------------------------------------------------

    async budgets(userId: string) {
      return db
        .select()
        .from(moneyBudget)
        .where(await visibleTo(userId, moneyBudget))
        .orderBy(asc(moneyBudget.createdAt), asc(moneyBudget.id))
    },

    async budget(budgetId: string, userId: string) {
      const [row] = await db
        .select()
        .from(moneyBudget)
        .where(eq(moneyBudget.id, budgetId))
      return row && (await mayAccess(row, userId)) ? row : undefined
    },

    /** Sets the budget of a category (or the total) in a space: changes the one that is there, or adds it. */
    async setBudget(userId: string, input: BudgetInput) {
      const householdId = input.householdId ?? null
      const [existing] = await db
        .select()
        .from(moneyBudget)
        .where(
          and(
            householdId
              ? eq(moneyBudget.organizationId, householdId)
              : and(eq(moneyBudget.userId, userId), isNull(moneyBudget.organizationId)),
            input.categoryId
              ? eq(moneyBudget.categoryId, input.categoryId)
              : isNull(moneyBudget.categoryId)
          )
        )
      if (existing) {
        const [row] = await db
          .update(moneyBudget)
          .set({ amountCents: input.amountCents })
          .where(eq(moneyBudget.id, existing.id))
          .returning()
        return { row: row! }
      }
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(moneyBudget)
        .values({
          id,
          userId,
          organizationId: householdId,
          categoryId: input.categoryId,
          amountCents: input.amountCents,
        })
        .onConflictDoNothing()
        .returning()
      return created ? { row: created } : { conflict: true as const }
    },

    async removeBudget(budgetId: string) {
      const rows = await db
        .delete(moneyBudget)
        .where(eq(moneyBudget.id, budgetId))
        .returning({ id: moneyBudget.id })
      return rows.length > 0
    },

    // -- bills --------------------------------------------------------------

    async bills(userId: string) {
      return (await db
        .select()
        .from(moneyBill)
        .where(await visibleTo(userId, moneyBill))
        .orderBy(asc(moneyBill.createdAt), asc(moneyBill.id))) as BillRow[]
    },

    async bill(billId: string, userId: string) {
      const [row] = await db.select().from(moneyBill).where(eq(moneyBill.id, billId))
      return row && (await mayAccess(row, userId)) ? (row as BillRow) : undefined
    },

    async createBill(userId: string, input: BillInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(moneyBill)
        .values({
          id,
          userId,
          organizationId: input.householdId ?? null,
          title: input.title,
          amountCents: input.amountCents,
          categoryId: input.categoryId ?? null,
          repeat: input.repeat,
          nextDue: input.nextDue,
          dayOfMonth: Number(input.nextDue.slice(8, 10)),
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created as BillRow }
      const existing = await this.bill(id, userId)
      return existing ? { row: existing } : { conflict: true as const }
    },

    async updateBill(billId: string, change: BillUpdate) {
      const [row] = await db
        .update(moneyBill)
        .set({
          ...(change.title !== undefined && { title: change.title }),
          ...(change.amountCents !== undefined && { amountCents: change.amountCents }),
          ...(change.categoryId !== undefined && { categoryId: change.categoryId }),
          ...(change.repeat !== undefined && { repeat: change.repeat }),
          ...(change.nextDue !== undefined && {
            nextDue: change.nextDue,
            dayOfMonth: Number(change.nextDue.slice(8, 10)),
          }),
        })
        .where(eq(moneyBill.id, billId))
        .returning()
      return row as BillRow | undefined
    },

    async removeBill(billId: string) {
      const rows = await db
        .delete(moneyBill)
        .where(eq(moneyBill.id, billId))
        .returning({ id: moneyBill.id })
      return rows.length > 0
    },

    /**
     * Pays a bill: adds the expense and moves the bill to its next day, in one step. The client
     * chooses the expense's id. When that expense is already there, the bill was paid before
     * (a retry), so nothing changes again.
     */
    async payBill(userId: string, bill: BillRow, pay: BillPay) {
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(moneyExpense)
          .values({
            id: pay.expenseId,
            userId,
            organizationId: bill.organizationId,
            amountCents: bill.amountCents,
            categoryId: bill.categoryId,
            date: pay.date,
            note: bill.title,
            paidBy: pay.paidBy ?? userId,
            billId: bill.id,
          })
          .onConflictDoNothing()
          .returning()
        if (!created) {
          const [current] = await tx.select().from(moneyBill).where(eq(moneyBill.id, bill.id))
          return { bill: current as BillRow, expense: undefined }
        }
        const [row] = await tx
          .update(moneyBill)
          .set({ nextDue: dueAfterPaying(bill, pay.date) })
          .where(eq(moneyBill.id, bill.id))
          .returning()
        return { bill: row as BillRow, expense: created }
      })
    },

    // -- savings ------------------------------------------------------------

    async goals(userId: string) {
      return db
        .select()
        .from(moneySavingsGoal)
        .where(await visibleTo(userId, moneySavingsGoal))
        .orderBy(asc(moneySavingsGoal.createdAt), asc(moneySavingsGoal.id))
    },

    async goal(goalId: string, userId: string) {
      const [row] = await db
        .select()
        .from(moneySavingsGoal)
        .where(eq(moneySavingsGoal.id, goalId))
      return row && (await mayAccess(row, userId)) ? row : undefined
    },

    async createGoal(userId: string, input: SavingsGoalInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(moneySavingsGoal)
        .values({
          id,
          userId,
          organizationId: input.householdId ?? null,
          name: input.name,
          targetCents: input.targetCents,
          targetDate: input.targetDate ?? null,
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created }
      const existing = await this.goal(id, userId)
      return existing ? { row: existing } : { conflict: true as const }
    },

    async updateGoal(goalId: string, change: SavingsGoalUpdate) {
      const [row] = await db
        .update(moneySavingsGoal)
        .set({
          ...(change.name !== undefined && { name: change.name }),
          ...(change.targetCents !== undefined && { targetCents: change.targetCents }),
          ...(change.targetDate !== undefined && { targetDate: change.targetDate }),
        })
        .where(eq(moneySavingsGoal.id, goalId))
        .returning()
      return row
    },

    async removeGoal(goalId: string) {
      const rows = await db
        .delete(moneySavingsGoal)
        .where(eq(moneySavingsGoal.id, goalId))
        .returning({ id: moneySavingsGoal.id })
      return rows.length > 0
    },

    async savingsEntries(userId: string) {
      const goalIds = (await this.goals(userId)).map((g) => g.id)
      if (goalIds.length === 0) return []
      return db
        .select()
        .from(moneySavingsEntry)
        .where(inArray(moneySavingsEntry.goalId, goalIds))
        .orderBy(
          asc(moneySavingsEntry.date),
          asc(moneySavingsEntry.createdAt),
          asc(moneySavingsEntry.id)
        )
    },

    async savingsEntry(entryId: string, userId: string) {
      const [row] = await db
        .select()
        .from(moneySavingsEntry)
        .where(eq(moneySavingsEntry.id, entryId))
      if (!row) return undefined
      return (await this.goal(row.goalId, userId)) ? row : undefined
    },

    /** Puts money into a goal, or takes it out. Sending an id that exists changes nothing. */
    async addSavingsEntry(goalId: string, input: SavingsEntryInput) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(moneySavingsEntry)
        .values({ id, goalId, amountCents: input.amountCents, date: input.date })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created }
      const [existing] = await db
        .select()
        .from(moneySavingsEntry)
        .where(and(eq(moneySavingsEntry.id, id), eq(moneySavingsEntry.goalId, goalId)))
      return existing ? { row: existing } : { conflict: true as const }
    },

    async removeSavingsEntry(entryId: string) {
      const rows = await db
        .delete(moneySavingsEntry)
        .where(eq(moneySavingsEntry.id, entryId))
        .returning({ id: moneySavingsEntry.id })
      return rows.length > 0
    },

    // -- receipts (see receipts.ts) -----------------------------------------

    async receipts(userId: string) {
      return db
        .select()
        .from(moneyReceipt)
        .where(await visibleTo(userId, moneyReceipt))
        .orderBy(asc(moneyReceipt.createdAt), asc(moneyReceipt.id))
    },

    async receipt(receiptId: string, userId: string) {
      const [row] = await db
        .select()
        .from(moneyReceipt)
        .where(eq(moneyReceipt.id, receiptId))
      return row && (await mayAccess(row, userId)) ? row : undefined
    },

    /** Adds a receipt that is still being read. Sending an id that exists returns that receipt. */
    async createReceipt(
      userId: string,
      input: { id?: string; householdId: string | null; fileId: string | null }
    ) {
      const id = input.id ?? randomUUID()
      const [created] = await db
        .insert(moneyReceipt)
        .values({
          id,
          userId,
          organizationId: input.householdId,
          fileId: input.fileId,
          status: "reading",
        })
        .onConflictDoNothing()
        .returning()
      if (created) return { row: created, isNew: true as const }
      const existing = await this.receipt(id, userId)
      return existing
        ? { row: existing, isNew: false as const }
        : { conflict: true as const }
    },

    async updateReceipt(
      receiptId: string,
      change: {
        status?: string
        shop?: string | null
        date?: string | null
        totalCents?: number | null
        error?: string | null
      }
    ) {
      const [row] = await db
        .update(moneyReceipt)
        .set({
          ...(change.status !== undefined && { status: change.status }),
          ...(change.shop !== undefined && { shop: change.shop }),
          ...(change.date !== undefined && { date: change.date }),
          ...(change.totalCents !== undefined && { totalCents: change.totalCents }),
          ...(change.error !== undefined && { error: change.error }),
        })
        .where(eq(moneyReceipt.id, receiptId))
        .returning()
      return row
    },

    /** Deletes the receipt. An expense made from it stays, without the link. */
    async removeReceipt(receiptId: string) {
      await db
        .update(moneyExpense)
        .set({ receiptId: null })
        .where(eq(moneyExpense.receiptId, receiptId))
      const rows = await db
        .delete(moneyReceipt)
        .where(eq(moneyReceipt.id, receiptId))
        .returning({ id: moneyReceipt.id })
      return rows.length > 0
    },

    /**
     * Turns a receipt into an expense and links the two. The client chooses the expense's id:
     * when that expense is already there, nothing changes (a retry).
     */
    async receiptToExpense(
      userId: string,
      receipt: ReceiptRow,
      input: {
        expenseId: string
        amountCents: number
        date: string
        categoryId: string | null
        paidBy: string
      }
    ) {
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(moneyExpense)
          .values({
            id: input.expenseId,
            userId,
            organizationId: receipt.organizationId,
            amountCents: input.amountCents,
            categoryId: input.categoryId,
            date: input.date,
            note: receipt.shop ?? "",
            paidBy: input.paidBy,
            receiptId: receipt.id,
          })
          .onConflictDoNothing()
          .returning()
        if (!created) {
          const [existing] = await tx
            .select()
            .from(moneyExpense)
            .where(eq(moneyExpense.id, input.expenseId))
          return { conflict: existing?.receiptId !== receipt.id, expense: existing }
        }
        await tx
          .update(moneyReceipt)
          .set({ expenseId: created.id })
          .where(eq(moneyReceipt.id, receipt.id))
        return { conflict: false, expense: created }
      })
    },
  }
}

export type MoneyStore = ReturnType<typeof moneyStore>
