import {
  budgetProgress,
  defaultCurrency,
  expensesInMonth,
  type Bill,
  type Budget,
  type Currency,
  type Expense,
  type MoneyCategory,
  type Receipt,
  type SavingsEntry,
  type SavingsGoal,
} from "@workspace/schemas"

import type { MoneyData } from "./money-ops"
import type { SpaceId } from "./space"

/** The money of one space (the person's own, or one household). Never mixes spaces. */
export type SpaceMoney = {
  currency: Currency
  categories: MoneyCategory[]
  expenses: Expense[]
  budgets: Budget[]
  bills: Bill[]
  goals: SavingsGoal[]
  savingsEntries: SavingsEntry[]
  receipts: Receipt[]
}

/** Only what belongs to the space. Savings entries follow their goals. */
export function moneyOfSpace(data: MoneyData, space: SpaceId): SpaceMoney {
  const here = <T extends { householdId: string | null }>(rows: T[]) =>
    rows.filter((row) => row.householdId === space)
  const goals = here(data.goals)
  const goalIds = new Set(goals.map((g) => g.id))
  return {
    currency:
      data.settings.find((s) => s.householdId === space)?.currency ??
      defaultCurrency,
    categories: here(data.categories),
    expenses: here(data.expenses),
    budgets: here(data.budgets),
    bills: here(data.bills),
    goals,
    savingsEntries: data.savingsEntries.filter((e) => goalIds.has(e.goalId)),
    receipts: here(data.receipts),
  }
}

/** Newest first: by day, then the one added last. */
export function newestFirst<T extends Pick<Expense, "date" | "createdAt" | "id">>(
  expenses: readonly T[]
): T[] {
  return [...expenses].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id)
  )
}

/** Filters for the list of expenses. Every filter that is empty lets everything through. */
export type ExpenseFilter = {
  month: string
  /** A category id, "none" for expenses without a category, or null for all. */
  categoryId: string | null
  search: string
}

export function filterExpenses(
  expenses: readonly Expense[],
  filter: ExpenseFilter
): Expense[] {
  const search = filter.search.trim().toLowerCase()
  return newestFirst(
    expensesInMonth(expenses, filter.month).filter(
      (expense) =>
        (filter.categoryId === null ||
          (filter.categoryId === "none"
            ? expense.categoryId === null
            : expense.categoryId === filter.categoryId)) &&
        (search === "" || expense.note.toLowerCase().includes(search))
    )
  )
}

/** The budgets of a month with how much of each is spent: the total first, then the rest. */
export function budgetsForMonth(
  budgets: readonly Budget[],
  expenses: readonly Expense[],
  month: string
) {
  const monthExpenses = expensesInMonth(expenses, month)
  return [...budgets]
    .sort((a, b) => Number(b.categoryId === null) - Number(a.categoryId === null))
    .map((budget) => budgetProgress(budget, monthExpenses))
}

/** Bills in the order they are due; ones that are paid for good (no next day) go last. */
export function billsByDue<T extends Pick<Bill, "nextDue" | "title">>(
  bills: readonly T[]
): T[] {
  return [...bills].sort((a, b) => {
    if (a.nextDue === b.nextDue) return a.title.localeCompare(b.title)
    if (a.nextDue === null) return 1
    if (b.nextDue === null) return -1
    return a.nextDue.localeCompare(b.nextDue)
  })
}
