import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import type { Database } from "@workspace/database"
import {
  BillInputSchema,
  BillPaySchema,
  BillSchema,
  BillUpdateSchema,
  BudgetInputSchema,
  BudgetSchema,
  ExpenseInputSchema,
  ExpenseSchema,
  ExpenseUpdateSchema,
  MoneyCategoryInputSchema,
  MoneyCategorySchema,
  MoneyCategoryUpdateSchema,
  MoneySettingsSchema,
  MoneySettingsUpdateSchema,
  ReceiptSchema,
  SavingsEntryInputSchema,
  SavingsEntrySchema,
  SavingsGoalInputSchema,
  SavingsGoalSchema,
  SavingsGoalUpdateSchema,
  type Bill,
  type Budget,
  type Expense,
  type MoneyCategory,
  type Receipt,
  type SavingsEntry,
  type SavingsGoal,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import {
  moneyStore,
  type BillRow,
  type BudgetRow,
  type CategoryRow,
  type ExpenseRow,
  type GoalRow,
  type ReceiptRow,
  type SavingsEntryRow,
} from "./store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Expense not found" }) })
  .openapi("Error")

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})
const error = (description: string) => json(ErrorSchema, description)
const body = <T extends z.ZodType>(schema: T) => ({
  content: { "application/json": { schema } },
  required: true as const,
})

const signedIn = { 401: error("Not signed in") }
const tags = ["Money"]
const security = [{ cookieAuth: [] }]
const notFound = (what: string) => error(`The ${what} doesn't exist, or you can't see it`)
const badSpace = error("Household not found, or you are not a member")
const conflict = error("That id is already used by someone else's entry")

const pathId = <K extends string>(name: K) =>
  z.object({
    [name]: z.string().openapi({ param: { name, in: "path" } }),
  } as Record<K, z.ZodString>)

const Settings = MoneySettingsSchema.openapi("MoneySettings")
const Category = MoneyCategorySchema.openapi("MoneyCategory")
const ExpenseBody = ExpenseSchema.openapi("Expense")
const BudgetBody = BudgetSchema.openapi("Budget")
const BillBody = BillSchema.openapi("Bill")
const GoalBody = SavingsGoalSchema.openapi("SavingsGoal")
const SavingsEntryBody = SavingsEntrySchema.openapi("SavingsEntry")
const ReceiptBody = ReceiptSchema.openapi("Receipt")

const Overview = z
  .object({
    settings: z.array(Settings),
    categories: z.array(Category),
    expenses: z.array(ExpenseBody),
    budgets: z.array(BudgetBody),
    bills: z.array(BillBody),
    goals: z.array(GoalBody),
    savingsEntries: z.array(SavingsEntryBody),
    receipts: z.array(ReceiptBody),
  })
  .openapi("MoneyOverview")

const overview = createRoute({
  method: "get",
  path: "/money",
  tags,
  security,
  summary: "Everything about money",
  description:
    "The currency, categories, expenses, budgets, bills, savings goals and receipts of the " +
    "person and of their households, in one answer, so the app can keep it on the phone. " +
    "A space that has no categories yet gets the built-in ones.",
  responses: { 200: json(Overview, "Everything the person can see"), ...signedIn },
})

const setSettings = createRoute({
  method: "put",
  path: "/money/settings",
  tags,
  security,
  summary: "Set the currency",
  description: "Sets the currency of the person's own money, or of a household with `householdId`.",
  request: { body: body(MoneySettingsUpdateSchema.openapi("MoneySettingsUpdate")) },
  responses: {
    200: json(z.object({ settings: Settings }), "The settings"),
    400: error("Invalid settings"),
    404: badSpace,
    ...signedIn,
  },
})

const createCategory = createRoute({
  method: "post",
  path: "/money/categories",
  tags,
  security,
  summary: "Add a category",
  request: { body: body(MoneyCategoryInputSchema.openapi("MoneyCategoryInput")) },
  responses: {
    201: json(z.object({ category: Category }), "Added, or already there"),
    400: error("Invalid category"),
    404: badSpace,
    409: conflict,
    ...signedIn,
  },
})

const renameCategory = createRoute({
  method: "patch",
  path: "/money/categories/{categoryId}",
  tags,
  security,
  summary: "Rename a category",
  description: "Also works for the built-in categories: the new name replaces the translated one.",
  request: {
    params: pathId("categoryId"),
    body: body(MoneyCategoryUpdateSchema.openapi("MoneyCategoryUpdate")),
  },
  responses: {
    200: json(z.object({ category: Category }), "The category"),
    400: error("Invalid name"),
    404: notFound("category"),
    ...signedIn,
  },
})

const deleteCategory = createRoute({
  method: "delete",
  path: "/money/categories/{categoryId}",
  tags,
  security,
  summary: "Delete a category",
  description:
    "Expenses and bills in it keep existing and have no category afterwards. Its budget is deleted.",
  request: { params: pathId("categoryId") },
  responses: { 204: { description: "Deleted" }, 404: notFound("category"), ...signedIn },
})

const createExpense = createRoute({
  method: "post",
  path: "/money/expenses",
  tags,
  security,
  summary: "Add an expense",
  description:
    "`householdId` adds it to a household's money; without it the expense is personal. `paidBy` " +
    "is the person who paid (in a household, any member). You may choose the `id`: sending an id " +
    "that already exists returns that expense and changes nothing.",
  request: { body: body(ExpenseInputSchema.openapi("ExpenseInput")) },
  responses: {
    201: json(z.object({ expense: ExpenseBody }), "Added, or already there"),
    400: error("Invalid expense"),
    404: badSpace,
    409: conflict,
    ...signedIn,
  },
})

const updateExpense = createRoute({
  method: "patch",
  path: "/money/expenses/{expenseId}",
  tags,
  security,
  summary: "Change an expense",
  request: {
    params: pathId("expenseId"),
    body: body(ExpenseUpdateSchema.openapi("ExpenseUpdate")),
  },
  responses: {
    200: json(z.object({ expense: ExpenseBody }), "The changed expense"),
    400: error("Invalid change"),
    404: notFound("expense"),
    ...signedIn,
  },
})

const deleteExpense = createRoute({
  method: "delete",
  path: "/money/expenses/{expenseId}",
  tags,
  security,
  summary: "Delete an expense",
  request: { params: pathId("expenseId") },
  responses: { 204: { description: "Deleted" }, 404: notFound("expense"), ...signedIn },
})

const setBudget = createRoute({
  method: "post",
  path: "/money/budgets",
  tags,
  security,
  summary: "Set a monthly budget",
  description:
    "Sets the budget of one category, or in total when `categoryId` is null. There is one budget " +
    "per category: setting it again changes the amount.",
  request: { body: body(BudgetInputSchema.openapi("BudgetInput")) },
  responses: {
    201: json(z.object({ budget: BudgetBody }), "The budget"),
    400: error("Invalid budget"),
    404: error("Household or category not found"),
    409: conflict,
    ...signedIn,
  },
})

const deleteBudget = createRoute({
  method: "delete",
  path: "/money/budgets/{budgetId}",
  tags,
  security,
  summary: "Delete a budget",
  request: { params: pathId("budgetId") },
  responses: { 204: { description: "Deleted" }, 404: notFound("budget"), ...signedIn },
})

const createBill = createRoute({
  method: "post",
  path: "/money/bills",
  tags,
  security,
  summary: "Add a bill",
  description: "A bill with an amount, the first day it is due and how often it comes back.",
  request: { body: body(BillInputSchema.openapi("BillInput")) },
  responses: {
    201: json(z.object({ bill: BillBody }), "Added, or already there"),
    400: error("Invalid bill"),
    404: error("Household or category not found"),
    409: conflict,
    ...signedIn,
  },
})

const updateBill = createRoute({
  method: "patch",
  path: "/money/bills/{billId}",
  tags,
  security,
  summary: "Change a bill",
  request: { params: pathId("billId"), body: body(BillUpdateSchema.openapi("BillUpdate")) },
  responses: {
    200: json(z.object({ bill: BillBody }), "The changed bill"),
    400: error("Invalid change"),
    404: notFound("bill"),
    ...signedIn,
  },
})

const deleteBill = createRoute({
  method: "delete",
  path: "/money/bills/{billId}",
  tags,
  security,
  summary: "Delete a bill",
  description: "Expenses that paid the bill stay.",
  request: { params: pathId("billId") },
  responses: { 204: { description: "Deleted" }, 404: notFound("bill"), ...signedIn },
})

const payBill = createRoute({
  method: "post",
  path: "/money/bills/{billId}/pay",
  tags,
  security,
  summary: "Mark a bill as paid",
  description:
    "Adds an expense for the bill (same amount and category) and moves the bill to its next due " +
    "day, in one step. You choose the expense's `id`: paying again with the same id changes nothing.",
  request: { params: pathId("billId"), body: body(BillPaySchema.openapi("BillPay")) },
  responses: {
    200: json(
      z.object({ bill: BillBody, expense: ExpenseBody.nullable() }),
      "The bill, and the expense (null when it was already paid with this id)"
    ),
    400: error("Invalid payment"),
    404: notFound("bill"),
    ...signedIn,
  },
})

const createGoal = createRoute({
  method: "post",
  path: "/money/savings",
  tags,
  security,
  summary: "Add a savings goal",
  request: { body: body(SavingsGoalInputSchema.openapi("SavingsGoalInput")) },
  responses: {
    201: json(z.object({ goal: GoalBody }), "Added, or already there"),
    400: error("Invalid goal"),
    404: badSpace,
    409: conflict,
    ...signedIn,
  },
})

const updateGoal = createRoute({
  method: "patch",
  path: "/money/savings/{goalId}",
  tags,
  security,
  summary: "Change a savings goal",
  request: {
    params: pathId("goalId"),
    body: body(SavingsGoalUpdateSchema.openapi("SavingsGoalUpdate")),
  },
  responses: {
    200: json(z.object({ goal: GoalBody }), "The changed goal"),
    400: error("Invalid change"),
    404: notFound("savings goal"),
    ...signedIn,
  },
})

const deleteGoal = createRoute({
  method: "delete",
  path: "/money/savings/{goalId}",
  tags,
  security,
  summary: "Delete a savings goal",
  description: "Its entries are deleted with it.",
  request: { params: pathId("goalId") },
  responses: { 204: { description: "Deleted" }, 404: notFound("savings goal"), ...signedIn },
})

const addSavings = createRoute({
  method: "post",
  path: "/money/savings/{goalId}/entries",
  tags,
  security,
  summary: "Put money into a goal, or take it out",
  description:
    "A positive `amountCents` puts money in, a negative one takes it out. Sending an id that " +
    "already exists returns that entry and changes nothing.",
  request: {
    params: pathId("goalId"),
    body: body(SavingsEntryInputSchema.openapi("SavingsEntryInput")),
  },
  responses: {
    201: json(z.object({ entry: SavingsEntryBody }), "Added, or already there"),
    400: error("Invalid entry"),
    404: notFound("savings goal"),
    409: error("That id belongs to another goal"),
    ...signedIn,
  },
})

const deleteSavings = createRoute({
  method: "delete",
  path: "/money/savings/entries/{entryId}",
  tags,
  security,
  summary: "Delete a savings entry",
  request: { params: pathId("entryId") },
  responses: { 204: { description: "Deleted" }, 404: notFound("entry"), ...signedIn },
})

type Env = { Variables: AuthVariables }

export const toCategory = (row: CategoryRow): MoneyCategory => ({
  id: row.id,
  key: row.key,
  name: row.name,
  householdId: row.organizationId,
})
export const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  amountCents: row.amountCents,
  categoryId: row.categoryId,
  date: row.date,
  note: row.note,
  paidBy: row.paidBy,
  split: row.split,
  billId: row.billId,
  receiptId: row.receiptId,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})
const toBudget = (row: BudgetRow): Budget => ({
  id: row.id,
  categoryId: row.categoryId,
  amountCents: row.amountCents,
  householdId: row.organizationId,
})
export const toBill = (row: BillRow): Bill => ({
  id: row.id,
  title: row.title,
  amountCents: row.amountCents,
  categoryId: row.categoryId,
  repeat: row.repeat,
  nextDue: row.nextDue,
  dayOfMonth: row.dayOfMonth,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})
const toGoal = (row: GoalRow): SavingsGoal => ({
  id: row.id,
  name: row.name,
  targetCents: row.targetCents,
  targetDate: row.targetDate,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})
const toSavingsEntry = (row: SavingsEntryRow): SavingsEntry => ({
  id: row.id,
  goalId: row.goalId,
  amountCents: row.amountCents,
  date: row.date,
})
export const toReceipt = (row: ReceiptRow): Receipt => ({
  id: row.id,
  fileId: row.fileId,
  status: row.status as Receipt["status"],
  shop: row.shop,
  date: row.date,
  totalCents: row.totalCents,
  items: row.items,
  expenseId: row.expenseId,
  error: row.error,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

/** Money endpoints. Mounted under /api. */
export function moneyRoutes(db: Database, auth: Auth) {
  const store = moneyStore(db)

  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = issue?.path.join(".")
        return c.json(
          { error: field ? `${field}: ${issue?.message}` : "Invalid request" },
          400
        )
      }
    },
  })

  for (const path of ["/money", "/money/*"]) {
    app.use(path, requireSession(auth))
  }

  /** Whether a category can be used in a space: none, or one of that space's own. */
  const categoryOk = async (
    categoryId: string | null | undefined,
    userId: string,
    householdId: string | null
  ) => !categoryId || (await store.categoryInSpace(categoryId, userId, householdId))

  app.openapi(overview, async (c) => {
    const userId = c.get("user").id
    await store.ensureCategories(userId)
    const [settings, categories, expenses, budgets, bills, goals, entries, receipts] =
      await Promise.all([
        store.settingsFor(userId),
        store.categories(userId),
        store.expenses(userId),
        store.budgets(userId),
        store.bills(userId),
        store.goals(userId),
        store.savingsEntries(userId),
        store.receipts(userId),
      ])
    return c.json(
      {
        settings,
        categories: categories.map(toCategory),
        expenses: expenses.map(toExpense),
        budgets: budgets.map(toBudget),
        bills: bills.map(toBill),
        goals: goals.map(toGoal),
        savingsEntries: entries.map(toSavingsEntry),
        receipts: receipts.map(toReceipt),
      },
      200
    )
  })

  app.openapi(setSettings, async (c) => {
    const { householdId = null, currency } = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    await store.setCurrency(userId, householdId, currency)
    return c.json({ settings: { householdId, currency } }, 200)
  })

  app.openapi(createCategory, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await store.createCategory(userId, input)
    if ("conflict" in result) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ category: toCategory(result.row) }, 201)
  })

  app.openapi(renameCategory, async (c) => {
    const { categoryId } = c.req.valid("param")
    if (!(await store.category(categoryId, c.get("user").id))) {
      return c.json({ error: "Category not found" }, 404)
    }
    const row = await store.renameCategory(categoryId, c.req.valid("json").name)
    if (!row) return c.json({ error: "Category not found" }, 404)
    return c.json({ category: toCategory(row) }, 200)
  })

  app.openapi(deleteCategory, async (c) => {
    const { categoryId } = c.req.valid("param")
    if (
      !(await store.category(categoryId, c.get("user").id)) ||
      !(await store.removeCategory(categoryId))
    ) {
      return c.json({ error: "Category not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(createExpense, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    const householdId = input.householdId ?? null
    if (!(await store.mayUse(userId, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    if (
      !(await categoryOk(input.categoryId, userId, householdId)) ||
      !(await store.mayPay(householdId, userId, input.paidBy ?? userId)) ||
      !(await store.mayShare(householdId, userId, input.split))
    ) {
      return c.json({ error: "Category or payer not found" }, 400)
    }
    const result = await store.createExpense(userId, input)
    if ("conflict" in result) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ expense: toExpense(result.row) }, 201)
  })

  app.openapi(updateExpense, async (c) => {
    const { expenseId } = c.req.valid("param")
    const userId = c.get("user").id
    const current = await store.expense(expenseId, userId)
    if (!current) return c.json({ error: "Expense not found" }, 404)
    const change = c.req.valid("json")
    if (
      !(await categoryOk(change.categoryId, userId, current.organizationId)) ||
      (change.paidBy !== undefined &&
        !(await store.mayPay(current.organizationId, userId, change.paidBy))) ||
      !(await store.mayShare(current.organizationId, userId, change.split))
    ) {
      return c.json({ error: "Category or payer not found" }, 400)
    }
    const row = await store.updateExpense(expenseId, change)
    if (!row) return c.json({ error: "Expense not found" }, 404)
    return c.json({ expense: toExpense(row) }, 200)
  })

  app.openapi(deleteExpense, async (c) => {
    const { expenseId } = c.req.valid("param")
    if (
      !(await store.expense(expenseId, c.get("user").id)) ||
      !(await store.removeExpense(expenseId))
    ) {
      return c.json({ error: "Expense not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(setBudget, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    const householdId = input.householdId ?? null
    if (
      !(await store.mayUse(userId, householdId)) ||
      !(await categoryOk(input.categoryId, userId, householdId))
    ) {
      return c.json({ error: "Household or category not found" }, 404)
    }
    const result = await store.setBudget(userId, input)
    if ("conflict" in result) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ budget: toBudget(result.row) }, 201)
  })

  app.openapi(deleteBudget, async (c) => {
    const { budgetId } = c.req.valid("param")
    if (
      !(await store.budget(budgetId, c.get("user").id)) ||
      !(await store.removeBudget(budgetId))
    ) {
      return c.json({ error: "Budget not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(createBill, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    const householdId = input.householdId ?? null
    if (
      !(await store.mayUse(userId, householdId)) ||
      !(await categoryOk(input.categoryId, userId, householdId))
    ) {
      return c.json({ error: "Household or category not found" }, 404)
    }
    const result = await store.createBill(userId, input)
    if ("conflict" in result) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ bill: toBill(result.row) }, 201)
  })

  app.openapi(updateBill, async (c) => {
    const { billId } = c.req.valid("param")
    const userId = c.get("user").id
    const current = await store.bill(billId, userId)
    if (!current) return c.json({ error: "Bill not found" }, 404)
    const change = c.req.valid("json")
    if (!(await categoryOk(change.categoryId, userId, current.organizationId))) {
      return c.json({ error: "Category not found" }, 400)
    }
    const row = await store.updateBill(billId, change)
    if (!row) return c.json({ error: "Bill not found" }, 404)
    return c.json({ bill: toBill(row) }, 200)
  })

  app.openapi(deleteBill, async (c) => {
    const { billId } = c.req.valid("param")
    if (!(await store.bill(billId, c.get("user").id)) || !(await store.removeBill(billId))) {
      return c.json({ error: "Bill not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(payBill, async (c) => {
    const { billId } = c.req.valid("param")
    const userId = c.get("user").id
    const bill = await store.bill(billId, userId)
    if (!bill) return c.json({ error: "Bill not found" }, 404)
    const pay = c.req.valid("json")
    if (
      !(await store.mayPay(bill.organizationId, userId, pay.paidBy ?? userId)) ||
      !(await store.mayShare(bill.organizationId, userId, pay.split))
    ) {
      return c.json({ error: "Payer not found" }, 400)
    }
    const result = await store.payBill(userId, bill, pay)
    return c.json(
      {
        bill: toBill(result.bill),
        expense: result.expense ? toExpense(result.expense) : null,
      },
      200
    )
  })

  app.openapi(createGoal, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await store.createGoal(userId, input)
    if ("conflict" in result) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ goal: toGoal(result.row) }, 201)
  })

  app.openapi(updateGoal, async (c) => {
    const { goalId } = c.req.valid("param")
    if (!(await store.goal(goalId, c.get("user").id))) {
      return c.json({ error: "Savings goal not found" }, 404)
    }
    const row = await store.updateGoal(goalId, c.req.valid("json"))
    if (!row) return c.json({ error: "Savings goal not found" }, 404)
    return c.json({ goal: toGoal(row) }, 200)
  })

  app.openapi(deleteGoal, async (c) => {
    const { goalId } = c.req.valid("param")
    if (!(await store.goal(goalId, c.get("user").id)) || !(await store.removeGoal(goalId))) {
      return c.json({ error: "Savings goal not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(addSavings, async (c) => {
    const { goalId } = c.req.valid("param")
    if (!(await store.goal(goalId, c.get("user").id))) {
      return c.json({ error: "Savings goal not found" }, 404)
    }
    const result = await store.addSavingsEntry(goalId, c.req.valid("json"))
    if ("conflict" in result) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ entry: toSavingsEntry(result.row) }, 201)
  })

  app.openapi(deleteSavings, async (c) => {
    const { entryId } = c.req.valid("param")
    if (
      !(await store.savingsEntry(entryId, c.get("user").id)) ||
      !(await store.removeSavingsEntry(entryId))
    ) {
      return c.json({ error: "Entry not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
