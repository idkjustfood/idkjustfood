import {
  dueAfterPaying,
  type Bill,
  type BillInput,
  type BillUpdate,
  type Budget,
  type Currency,
  type Expense,
  type ExpenseUpdate,
  type MoneyCategory,
  type MoneySettings,
  type Receipt,
  type ReceiptUpdate,
  type SavingsEntry,
  type SavingsGoal,
  type SavingsGoalUpdate,
} from "@workspace/schemas"

/** Everything the person can see about money, as the server sends it. */
export type MoneyData = {
  settings: MoneySettings[]
  categories: MoneyCategory[]
  expenses: Expense[]
  budgets: Budget[]
  bills: Bill[]
  goals: SavingsGoal[]
  savingsEntries: SavingsEntry[]
  receipts: Receipt[]
}

export const emptyMoney: MoneyData = {
  settings: [],
  categories: [],
  expenses: [],
  budgets: [],
  bills: [],
  goals: [],
  savingsEntries: [],
  receipts: [],
}

/**
 * A change to money, made on this device. Changes are kept in a queue and sent to the server in
 * order, so money also works without a connection. Every change uses ids chosen on the device
 * and absolute values, so sending one twice does no harm.
 */
export type MoneyOp =
  | { type: "setCurrency"; householdId: string | null; currency: Currency }
  | { type: "addCategory"; id: string; name: string; householdId: string | null }
  | { type: "renameCategory"; id: string; name: string }
  | { type: "removeCategory"; id: string }
  | {
      type: "addExpense"
      id: string
      amountCents: number
      categoryId: string | null
      date: string
      note: string
      paidBy: string
      householdId: string | null
    }
  | { type: "updateExpense"; id: string; change: ExpenseUpdate }
  | { type: "removeExpense"; id: string }
  | {
      type: "setBudget"
      id: string
      categoryId: string | null
      amountCents: number
      householdId: string | null
    }
  | { type: "removeBudget"; id: string }
  | ({ type: "addBill"; id: string; householdId: string | null } & Omit<
      BillInput,
      "id" | "householdId"
    >)
  | { type: "updateBill"; id: string; change: BillUpdate }
  | { type: "removeBill"; id: string }
  | {
      type: "payBill"
      billId: string
      expenseId: string
      date: string
      paidBy: string
    }
  | {
      type: "addGoal"
      id: string
      name: string
      targetCents: number
      targetDate: string | null
      householdId: string | null
    }
  | { type: "updateGoal"; id: string; change: SavingsGoalUpdate }
  | { type: "removeGoal"; id: string }
  | {
      type: "addSavings"
      id: string
      goalId: string
      amountCents: number
      date: string
    }
  | { type: "removeSavings"; id: string }
  | { type: "updateReceipt"; id: string; change: ReceiptUpdate }
  | { type: "removeReceipt"; id: string }
  | { type: "receiptToExpense"; id: string; expense: Expense }

/** A change without the fields that were not given. */
function definedOnly<T extends object>(change: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(change).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

const patch = <T extends { id: string }>(
  rows: T[],
  id: string,
  change: object
): T[] =>
  rows.map((row) => (row.id === id ? { ...row, ...definedOnly(change) } : row))

/** Adds a row, unless one with that id is already there. */
const add = <T extends { id: string }>(rows: T[], row: T): T[] =>
  rows.some((existing) => existing.id === row.id) ? rows : [...rows, row]

/** The money after one change. Never changes its input. */
export function applyMoneyOp(
  data: MoneyData,
  op: MoneyOp,
  now = new Date().toISOString()
): MoneyData {
  switch (op.type) {
    case "setCurrency": {
      const exists = data.settings.some((s) => s.householdId === op.householdId)
      return {
        ...data,
        settings: exists
          ? data.settings.map((s) =>
              s.householdId === op.householdId ? { ...s, currency: op.currency } : s
            )
          : [...data.settings, { householdId: op.householdId, currency: op.currency }],
      }
    }
    case "addCategory":
      return {
        ...data,
        categories: add(data.categories, {
          id: op.id,
          key: null,
          name: op.name,
          householdId: op.householdId,
        }),
      }
    case "renameCategory":
      return { ...data, categories: patch(data.categories, op.id, { name: op.name }) }
    case "removeCategory":
      return {
        ...data,
        categories: data.categories.filter((c) => c.id !== op.id),
        // The server keeps expenses and bills without a category, and deletes the budget.
        expenses: data.expenses.map((e) =>
          e.categoryId === op.id ? { ...e, categoryId: null } : e
        ),
        bills: data.bills.map((b) =>
          b.categoryId === op.id ? { ...b, categoryId: null } : b
        ),
        budgets: data.budgets.filter((b) => b.categoryId !== op.id),
      }
    case "addExpense":
      return {
        ...data,
        expenses: add(data.expenses, {
          id: op.id,
          amountCents: op.amountCents,
          categoryId: op.categoryId,
          date: op.date,
          note: op.note,
          paidBy: op.paidBy,
          billId: null,
          receiptId: null,
          householdId: op.householdId,
          createdAt: now,
        }),
      }
    case "updateExpense":
      return { ...data, expenses: patch(data.expenses, op.id, op.change) }
    case "removeExpense":
      return { ...data, expenses: data.expenses.filter((e) => e.id !== op.id) }
    case "setBudget": {
      // One budget per category and space: setting it again changes the amount.
      const same = data.budgets.find(
        (b) => b.categoryId === op.categoryId && b.householdId === op.householdId
      )
      return {
        ...data,
        budgets: same
          ? patch(data.budgets, same.id, { amountCents: op.amountCents })
          : add(data.budgets, {
              id: op.id,
              categoryId: op.categoryId,
              amountCents: op.amountCents,
              householdId: op.householdId,
            }),
      }
    }
    case "removeBudget":
      return { ...data, budgets: data.budgets.filter((b) => b.id !== op.id) }
    case "addBill":
      return {
        ...data,
        bills: add(data.bills, {
          id: op.id,
          title: op.title,
          amountCents: op.amountCents,
          categoryId: op.categoryId ?? null,
          repeat: op.repeat,
          nextDue: op.nextDue,
          dayOfMonth: Number(op.nextDue.slice(8, 10)),
          householdId: op.householdId,
          createdAt: now,
        }),
      }
    case "updateBill":
      return {
        ...data,
        bills: data.bills.map((bill) =>
          bill.id === op.id
            ? {
                ...bill,
                ...definedOnly(op.change),
                ...(op.change.nextDue && {
                  dayOfMonth: Number(op.change.nextDue.slice(8, 10)),
                }),
              }
            : bill
        ),
      }
    case "removeBill":
      return {
        ...data,
        bills: data.bills.filter((b) => b.id !== op.id),
        expenses: data.expenses.map((e) =>
          e.billId === op.id ? { ...e, billId: null } : e
        ),
      }
    case "payBill": {
      const bill = data.bills.find((b) => b.id === op.billId)
      // Paying again with the same expense id changes nothing (a retry).
      if (!bill || data.expenses.some((e) => e.id === op.expenseId)) return data
      return {
        ...data,
        expenses: [
          ...data.expenses,
          {
            id: op.expenseId,
            amountCents: bill.amountCents,
            categoryId: bill.categoryId,
            date: op.date,
            note: bill.title,
            paidBy: op.paidBy,
            billId: bill.id,
            receiptId: null,
            householdId: bill.householdId,
            createdAt: now,
          },
        ],
        bills: data.bills.map((b) =>
          b.id === bill.id ? { ...b, nextDue: dueAfterPaying(bill, op.date) } : b
        ),
      }
    }
    case "addGoal":
      return {
        ...data,
        goals: add(data.goals, {
          id: op.id,
          name: op.name,
          targetCents: op.targetCents,
          targetDate: op.targetDate,
          householdId: op.householdId,
          createdAt: now,
        }),
      }
    case "updateGoal":
      return { ...data, goals: patch(data.goals, op.id, op.change) }
    case "removeGoal":
      return {
        ...data,
        goals: data.goals.filter((g) => g.id !== op.id),
        savingsEntries: data.savingsEntries.filter((e) => e.goalId !== op.id),
      }
    case "addSavings":
      return {
        ...data,
        savingsEntries: add(data.savingsEntries, {
          id: op.id,
          goalId: op.goalId,
          amountCents: op.amountCents,
          date: op.date,
        }),
      }
    case "removeSavings":
      return {
        ...data,
        savingsEntries: data.savingsEntries.filter((e) => e.id !== op.id),
      }
    case "updateReceipt":
      return { ...data, receipts: patch(data.receipts, op.id, op.change) }
    case "removeReceipt":
      return { ...data, receipts: data.receipts.filter((r) => r.id !== op.id) }
    case "receiptToExpense":
      if (data.expenses.some((e) => e.id === op.expense.id)) return data
      return {
        ...data,
        expenses: [...data.expenses, op.expense],
        receipts: patch(data.receipts, op.id, { expenseId: op.expense.id }),
      }
  }
}

/** The server's data with the changes that are still waiting to be sent put on top. */
export function applyMoneyOps(data: MoneyData, queue: MoneyOp[]): MoneyData {
  return queue.reduce((all, op) => applyMoneyOp(all, op), data)
}
