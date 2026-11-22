import { z } from "zod"

import { addMonths, monthOf } from "./calendar.js"
import { addDays, DateSchema } from "./planner.js"

/**
 * Money: expenses, budgets, bills and savings goals. Everything is personal or belongs to a
 * household, like shopping lists and chores.
 *
 * Amounts are whole **cents** (integers), never decimals, so 0.10 + 0.20 is exactly 0.30. A
 * space (a person or a household) has one currency, chosen in the settings.
 */

/** The largest amount we accept, in cents. Keeps sums far away from integer limits. */
export const MAX_CENTS = 100_000_000_00

/** An amount of money in cents. Whole and never negative; what it means is up to the field. */
export const CentsSchema = z.number().int().min(0).max(MAX_CENTS)

/** A money amount that is more than nothing (an expense, a bill, a budget, a goal). */
const PositiveCentsSchema = z.number().int().min(1).max(MAX_CENTS)

const id = z.string().min(1).max(100)
const name = z.string().trim().min(1).max(200)
const householdId = z.string().nullable()

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/** The currencies a space can use. All of them have two decimals (cents). */
export const currencies = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
] as const
export type Currency = (typeof currencies)[number]
export const CurrencySchema = z.enum(currencies)
export const defaultCurrency: Currency = "EUR"

export const MoneySettingsSchema = z.object({
  /** The household the settings belong to, or null for the person's own money. */
  householdId,
  currency: CurrencySchema,
})
export type MoneySettings = z.infer<typeof MoneySettingsSchema>

export const MoneySettingsUpdateSchema = z.object({
  householdId: householdId.optional(),
  currency: CurrencySchema,
})
export type MoneySettingsUpdate = z.infer<typeof MoneySettingsUpdateSchema>

// ---------------------------------------------------------------------------
// Parsing and splitting amounts
// ---------------------------------------------------------------------------

/**
 * Reads what a person typed ("12,50", "12.5", "1.234,56", "1,234.56", "12") as cents. Returns
 * null when it is not an amount, so the screen can say so instead of guessing. The last
 * `.` or `,` with one or two digits after it is the decimal mark; everything else is a
 * thousands separator.
 */
export function parseCents(text: string): number | null {
  const value = text.trim().replace(/[\s'’]/g, "")
  if (!/^\d[\d.,]*$/.test(value)) return null
  const mark = Math.max(value.lastIndexOf("."), value.lastIndexOf(","))
  let whole = value
  let fraction = ""
  if (mark >= 0 && value.length - mark - 1 <= 2 && value.length - mark - 1 > 0) {
    whole = value.slice(0, mark)
    fraction = value.slice(mark + 1)
  }
  if (!/^\d+([.,]\d{3})*$/.test(whole)) return null
  const cents =
    Number(whole.replace(/[.,]/g, "")) * 100 +
    Number(fraction.padEnd(2, "0") || 0)
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}

/**
 * Splits an amount into equal parts in whole cents. The first parts get the extra cents, so
 * the parts always add up to the amount exactly (100 cents in 3 is 34 + 33 + 33).
 */
export function splitCents(total: number, parts: number): number[] {
  const count = Math.max(1, Math.floor(parts))
  const base = Math.floor(total / count)
  const extra = total - base * count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * The categories every space starts with. The app shows their name in the person's language;
 * renaming one gives it a name of its own. `key` is stored, so it never changes.
 */
export const defaultCategoryKeys = [
  "groceries",
  "eatingOut",
  "home",
  "transport",
  "health",
  "fun",
  "clothing",
  "gifts",
  "other",
] as const
export type DefaultCategoryKey = (typeof defaultCategoryKeys)[number]

export const MoneyCategorySchema = z.object({
  id: z.string(),
  /** Set for a built-in category, null for one the person made. */
  key: z.string().nullable(),
  /** The name the person gave. Null means show the built-in name for `key`. */
  name: z.string().nullable(),
  householdId,
})
export type MoneyCategory = z.infer<typeof MoneyCategorySchema>

export const MoneyCategoryInputSchema = z.object({
  id: id.optional(),
  name,
  householdId: householdId.optional(),
})
export type MoneyCategoryInput = z.infer<typeof MoneyCategoryInputSchema>

export const MoneyCategoryUpdateSchema = z.object({ name })
export type MoneyCategoryUpdate = z.infer<typeof MoneyCategoryUpdateSchema>

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const ExpenseSchema = z.object({
  id: z.string(),
  amountCents: PositiveCentsSchema,
  /** The category, or null for "no category". */
  categoryId: z.string().nullable(),
  /** The day of the expense, `YYYY-MM-DD`. */
  date: DateSchema,
  note: z.string().max(500),
  /** Who paid. Matters in a household, where it decides who owes whom. */
  paidBy: z.string(),
  /** The bill this expense paid, or null. */
  billId: z.string().nullable(),
  /** The receipt this expense came from, or null. */
  receiptId: z.string().nullable(),
  householdId,
  createdAt: z.string(),
})
export type Expense = z.infer<typeof ExpenseSchema>

export const ExpenseInputSchema = z.object({
  id: id.optional(),
  amountCents: PositiveCentsSchema,
  categoryId: z.string().nullable().optional(),
  date: DateSchema,
  note: z.string().max(500).optional(),
  /** Left out means the person who adds it. */
  paidBy: z.string().optional(),
  receiptId: z.string().nullable().optional(),
  householdId: householdId.optional(),
})
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>

export const ExpenseUpdateSchema = z.object({
  amountCents: PositiveCentsSchema.optional(),
  categoryId: z.string().nullable().optional(),
  date: DateSchema.optional(),
  note: z.string().max(500).optional(),
  paidBy: z.string().optional(),
})
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>

/** The expenses of one month (`YYYY-MM`). */
export function expensesInMonth<T extends Pick<Expense, "date">>(
  expenses: readonly T[],
  month: string
): T[] {
  return expenses.filter((expense) => monthOf(expense.date) === month)
}

/** The sum of the amounts, in cents. */
export function sumCents(items: readonly { amountCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0)
}

/** Spending per category (`null` is "no category"), biggest first. */
export function spendingByCategory(
  expenses: readonly Pick<Expense, "categoryId" | "amountCents">[]
): { categoryId: string | null; cents: number }[] {
  const totals = new Map<string | null, number>()
  for (const expense of expenses) {
    totals.set(
      expense.categoryId,
      (totals.get(expense.categoryId) ?? 0) + expense.amountCents
    )
  }
  return [...totals]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .sort((a, b) => b.cents - a.cents)
}

/**
 * Who owes whom in a household. Every expense is shared equally between all `members`, and the
 * person who paid is owed the other members' parts. Returns the net balance per member in cents:
 * positive means they are owed money, negative means they owe. The balances add up to zero.
 */
export function balances(
  expenses: readonly Pick<Expense, "amountCents" | "paidBy">[],
  members: readonly string[]
): Map<string, number> {
  const result = new Map(members.map((member) => [member, 0]))
  if (members.length === 0) return result
  for (const expense of expenses) {
    if (!result.has(expense.paidBy)) continue
    const shares = splitCents(expense.amountCents, members.length)
    // The payer's own share is the first one, so the extra cents are not always the same person's.
    const others = members.filter((member) => member !== expense.paidBy)
    const ownShare = shares[0]!
    result.set(
      expense.paidBy,
      result.get(expense.paidBy)! + expense.amountCents - ownShare
    )
    others.forEach((member, index) => {
      result.set(member, result.get(member)! - shares[index + 1]!)
    })
  }
  return result
}

/**
 * The payments that settle the balances, fewest first: who pays whom how much. Greedy, which
 * is enough for a household.
 */
export function settleUp(
  balance: ReadonlyMap<string, number>
): { from: string; to: string; cents: number }[] {
  const debtors = [...balance]
    .filter(([, cents]) => cents < 0)
    .map(([member, cents]) => ({ member, cents: -cents }))
    .sort((a, b) => b.cents - a.cents)
  const creditors = [...balance]
    .filter(([, cents]) => cents > 0)
    .map(([member, cents]) => ({ member, cents }))
    .sort((a, b) => b.cents - a.cents)
  const payments: { from: string; to: string; cents: number }[] = []
  let d = 0
  let c = 0
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]!
    const creditor = creditors[c]!
    const cents = Math.min(debtor.cents, creditor.cents)
    if (cents > 0) payments.push({ from: debtor.member, to: creditor.member, cents })
    debtor.cents -= cents
    creditor.cents -= cents
    if (debtor.cents === 0) d++
    if (creditor.cents === 0) c++
  }
  return payments
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

/**
 * A monthly budget: the most the person wants to spend in a month, for one category or, when
 * `categoryId` is null, in total. It applies to every month.
 */
export const BudgetSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullable(),
  amountCents: PositiveCentsSchema,
  householdId,
})
export type Budget = z.infer<typeof BudgetSchema>

/**
 * Sets the budget of a category (or the total). Setting it again changes it; there is one
 * budget per category in a space.
 */
export const BudgetInputSchema = z.object({
  id: id.optional(),
  categoryId: z.string().nullable(),
  amountCents: PositiveCentsSchema,
  householdId: householdId.optional(),
})
export type BudgetInput = z.infer<typeof BudgetInputSchema>

export const BudgetUpdateSchema = z.object({ amountCents: PositiveCentsSchema })
export type BudgetUpdate = z.infer<typeof BudgetUpdateSchema>

/** When a budget needs attention: from this share of it spent, the screen warns. */
export const BUDGET_WARNING_SHARE = 0.8

export type BudgetState = "ok" | "nearly" | "over"

export type BudgetProgress = {
  budgetId: string
  categoryId: string | null
  budgetCents: number
  spentCents: number
  /** What is left. Negative when the budget is used up. */
  leftCents: number
  /** Share of the budget spent, 0 to 1 and more. */
  share: number
  state: BudgetState
}

/** How a budget stands after the expenses of one month. Only expenses of this space count. */
export function budgetProgress(
  budget: Pick<Budget, "id" | "categoryId" | "amountCents">,
  monthExpenses: readonly Pick<Expense, "categoryId" | "amountCents">[]
): BudgetProgress {
  const spentCents = sumCents(
    budget.categoryId === null
      ? monthExpenses
      : monthExpenses.filter((e) => e.categoryId === budget.categoryId)
  )
  const share = spentCents / budget.amountCents
  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    budgetCents: budget.amountCents,
    spentCents,
    leftCents: budget.amountCents - spentCents,
    share,
    state:
      spentCents > budget.amountCents
        ? "over"
        : share >= BUDGET_WARNING_SHARE
          ? "nearly"
          : "ok",
  }
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

/** How often a bill comes back. */
export const billRepeats = ["weekly", "monthly", "quarterly", "yearly", "never"] as const
export type BillRepeat = (typeof billRepeats)[number]
export const BillRepeatSchema = z.enum(billRepeats)

export const BillSchema = z.object({
  id: z.string(),
  title: name,
  amountCents: PositiveCentsSchema,
  categoryId: z.string().nullable(),
  repeat: BillRepeatSchema,
  /** The next day it has to be paid. Null when a bill that does not repeat was paid. */
  nextDue: DateSchema.nullable(),
  /** The day of the month a monthly, quarterly or yearly bill falls on, so a 31st survives short months. */
  dayOfMonth: z.number().int().min(1).max(31),
  householdId,
  createdAt: z.string(),
})
export type Bill = z.infer<typeof BillSchema>

export const BillInputSchema = z.object({
  id: id.optional(),
  title: name,
  amountCents: PositiveCentsSchema,
  categoryId: z.string().nullable().optional(),
  repeat: BillRepeatSchema,
  /** The first day it is due. */
  nextDue: DateSchema,
  householdId: householdId.optional(),
})
export type BillInput = z.infer<typeof BillInputSchema>

export const BillUpdateSchema = z.object({
  title: name.optional(),
  amountCents: PositiveCentsSchema.optional(),
  categoryId: z.string().nullable().optional(),
  repeat: BillRepeatSchema.optional(),
  nextDue: DateSchema.optional(),
})
export type BillUpdate = z.infer<typeof BillUpdateSchema>

/** What a client sends to pay a bill. The client chooses the expense's `id`, so a retry pays once. */
export const BillPaySchema = z.object({
  expenseId: id,
  /** The day it was paid. */
  date: DateSchema,
  paidBy: z.string().optional(),
})
export type BillPay = z.infer<typeof BillPaySchema>

/** The last day of a month (`YYYY-MM`). */
function daysInMonth(month: string): number {
  const [year, number] = month.split("-").map(Number)
  return new Date(Date.UTC(year!, number!, 0)).getUTCDate()
}

/** The day of the month in `month`, held back to its last day (the 31st becomes the 30th). */
function dayIn(month: string, dayOfMonth: number): string {
  return `${month}-${String(Math.min(dayOfMonth, daysInMonth(month))).padStart(2, "0")}`
}

/**
 * The day a bill is due after `due`. Monthly bills keep their day of the month, also after a
 * short month (the 31st goes to 28 February, then back to 31 March). A bill that does not
 * repeat has no next day (null).
 */
export function nextDueDate(
  due: string,
  repeat: BillRepeat,
  dayOfMonth = Number(due.slice(8, 10))
): string | null {
  switch (repeat) {
    case "never":
      return null
    case "weekly":
      return addDays(due, 7)
    case "monthly":
      return dayIn(addMonths(monthOf(due), 1), dayOfMonth)
    case "quarterly":
      return dayIn(addMonths(monthOf(due), 3), dayOfMonth)
    case "yearly":
      return dayIn(addMonths(monthOf(due), 12), dayOfMonth)
  }
}

/**
 * The next due day after paying: the one after the current due day, and, when that is already
 * past (the bill was paid very late), the first one that is not before `today`.
 */
export function dueAfterPaying(
  bill: Pick<Bill, "nextDue" | "repeat" | "dayOfMonth">,
  today: string
): string | null {
  if (!bill.nextDue) return null
  let next = nextDueDate(bill.nextDue, bill.repeat, bill.dayOfMonth)
  // A bill that repeats can only fall behind by a finite number of periods.
  for (let i = 0; next !== null && next < today && i < 1000; i++) {
    next = nextDueDate(next, bill.repeat, bill.dayOfMonth)
  }
  return next
}

/** How many days until the bill is due. Negative when it is overdue. Null for a paid one-off bill. */
export function daysUntilBill(
  bill: Pick<Bill, "nextDue">,
  today: string
): number | null {
  if (!bill.nextDue) return null
  const ms =
    new Date(`${bill.nextDue}T00:00:00Z`).getTime() -
    new Date(`${today}T00:00:00Z`).getTime()
  return Math.round(ms / 86_400_000)
}

/** Bills due today or earlier, the most overdue first. These are the ones Today shows. */
export function dueBills<T extends Pick<Bill, "nextDue">>(
  bills: readonly T[],
  today: string
): T[] {
  return bills
    .filter((bill) => bill.nextDue !== null && bill.nextDue <= today)
    .sort((a, b) => a.nextDue!.localeCompare(b.nextDue!))
}

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export const SavingsGoalSchema = z.object({
  id: z.string(),
  name,
  targetCents: PositiveCentsSchema,
  /** The day the goal should be reached, or null. */
  targetDate: DateSchema.nullable(),
  householdId,
  createdAt: z.string(),
})
export type SavingsGoal = z.infer<typeof SavingsGoalSchema>

export const SavingsGoalInputSchema = z.object({
  id: id.optional(),
  name,
  targetCents: PositiveCentsSchema,
  targetDate: DateSchema.nullable().optional(),
  householdId: householdId.optional(),
})
export type SavingsGoalInput = z.infer<typeof SavingsGoalInputSchema>

export const SavingsGoalUpdateSchema = z.object({
  name: name.optional(),
  targetCents: PositiveCentsSchema.optional(),
  targetDate: DateSchema.nullable().optional(),
})
export type SavingsGoalUpdate = z.infer<typeof SavingsGoalUpdateSchema>

/** Money put into a goal (positive) or taken out of it (negative). */
export const SavingsEntrySchema = z.object({
  id: z.string(),
  goalId: z.string(),
  /** Positive puts money in, negative takes it out. Never zero. */
  amountCents: z
    .number()
    .int()
    .min(-MAX_CENTS)
    .max(MAX_CENTS)
    .refine((value) => value !== 0, "Amount can't be zero"),
  date: DateSchema,
})
export type SavingsEntry = z.infer<typeof SavingsEntrySchema>

export const SavingsEntryInputSchema = z.object({
  id: id.optional(),
  amountCents: SavingsEntrySchema.shape.amountCents,
  date: DateSchema,
})
export type SavingsEntryInput = z.infer<typeof SavingsEntryInputSchema>

export type SavingsProgress = {
  goalId: string
  savedCents: number
  /** What is still missing. 0 when the goal is reached. */
  missingCents: number
  /** Share saved, 0 to 1 (never above 1). */
  share: number
  reached: boolean
}

/** How far a goal is. What is saved never goes below zero, so taking out too much shows 0. */
export function savingsProgress(
  goal: Pick<SavingsGoal, "id" | "targetCents">,
  entries: readonly Pick<SavingsEntry, "goalId" | "amountCents">[]
): SavingsProgress {
  const saved = Math.max(
    0,
    entries
      .filter((entry) => entry.goalId === goal.id)
      .reduce((sum, entry) => sum + entry.amountCents, 0)
  )
  return {
    goalId: goal.id,
    savedCents: saved,
    missingCents: Math.max(0, goal.targetCents - saved),
    share: Math.min(1, saved / goal.targetCents),
    reached: saved >= goal.targetCents,
  }
}

/**
 * How much to put aside each month to reach a goal on its day: what is missing, divided by the
 * months left (rounded up, so the goal is reached and not missed by a cent). The month of
 * `today` counts as one month left, up to and including the month of the target day. Null when
 * the goal has no day, is reached already, or its day has passed.
 */
export function monthlySavingsNeeded(
  goal: Pick<SavingsGoal, "targetDate">,
  progress: Pick<SavingsProgress, "missingCents" | "reached">,
  today: string
): number | null {
  if (!goal.targetDate || progress.reached || goal.targetDate < today) return null
  const [ty, tm] = goal.targetDate.split("-").map(Number)
  const [ny, nm] = today.split("-").map(Number)
  const months = (ty! - ny!) * 12 + (tm! - nm!) + 1
  return Math.ceil(progress.missingCents / months)
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export const receiptStatuses = ["reading", "ready", "failed"] as const
export type ReceiptStatus = (typeof receiptStatuses)[number]

/**
 * A photographed receipt. The AI fills `shop`, `date` and `totalCents` when it can read them;
 * what it cannot read stays null and is never guessed. The person checks and corrects the
 * values before turning the receipt into an expense.
 */
export const ReceiptSchema = z.object({
  id: z.string(),
  /** The stored photo (see files). */
  fileId: z.string().nullable(),
  status: z.enum(receiptStatuses),
  shop: z.string().nullable(),
  date: DateSchema.nullable(),
  totalCents: PositiveCentsSchema.nullable(),
  /** The expense made from this receipt, or null. */
  expenseId: z.string().nullable(),
  /** Why reading failed, when it did. */
  error: z.string().nullable(),
  householdId,
  createdAt: z.string(),
})
export type Receipt = z.infer<typeof ReceiptSchema>

export const ReceiptUpdateSchema = z.object({
  shop: z.string().trim().max(200).nullable().optional(),
  date: DateSchema.nullable().optional(),
  totalCents: PositiveCentsSchema.nullable().optional(),
})
export type ReceiptUpdate = z.infer<typeof ReceiptUpdateSchema>

/** What the AI reads from a receipt photo. Every field may be null: it never has to guess. */
export const ReceiptReadingSchema = z.object({
  shop: z.string().nullable(),
  date: z.string().nullable(),
  /** The total as printed, in cents. Null when unreadable. */
  totalCents: z.number().int().nullable(),
})
export type ReceiptReading = z.infer<typeof ReceiptReadingSchema>

/**
 * Cleans what the AI returned: keeps a date only when it is a real day, a total only when it is
 * a sensible amount, and trims the shop name. Anything else becomes null.
 */
export function cleanReading(reading: ReceiptReading): {
  shop: string | null
  date: string | null
  totalCents: number | null
} {
  const date = DateSchema.safeParse(reading.date)
  const total = PositiveCentsSchema.safeParse(reading.totalCents)
  const shop = reading.shop?.trim().slice(0, 200)
  return {
    shop: shop ? shop : null,
    date: date.success ? date.data : null,
    totalCents: total.success ? total.data : null,
  }
}
