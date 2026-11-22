import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type {
  Bill,
  Budget,
  Expense,
  MoneyCategory,
  SavingsEntry,
  SavingsGoal,
} from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

type Overview = {
  settings: { householdId: string | null; currency: string }[]
  categories: MoneyCategory[]
  expenses: Expense[]
  budgets: Budget[]
  bills: Bill[]
  goals: SavingsGoal[]
  savingsEntries: SavingsEntry[]
}

async function overview(cookie = olivia) {
  const res = await api.get("/api/money", cookie)
  expect(res.status).toBe(200)
  return body<Overview>(res)
}

async function categoryId(key: string, cookie = olivia) {
  return (await overview(cookie)).categories.find((c) => c.key === key)!.id
}

async function addExpense(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/money/expenses", cookie, {
    amountCents: 1250,
    date: "2026-11-20",
    ...extra,
  })
  expect(res.status).toBe(201)
  return (await body<{ expense: Expense }>(res)).expense
}

const patch = (path: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/money/${path}`, cookie, change)
const del = (path: string, cookie = olivia) =>
  api.request("DELETE", `/api/money/${path}`, cookie)

async function household(owner: string) {
  const res = await api.post("/api/households", owner, { name: "Home" })
  expect(res.status).toBe(201)
  const id = (await body<{ household: { id: string } }>(res)).household.id
  const member = await api.signUp("Sam")
  const invite = await api.post(`/api/households/${id}/invites`, owner)
  const { invite: link } = await body<{ invite: { id: string } }>(invite)
  await api.post(`/api/invites/${link.id}/accept`, member)
  return { id, member }
}

beforeEach(async () => {
  api = client(createApp(await createTestDb(), testEnv))
  olivia = await api.signUp("Olivia")
})

describe("money in general", () => {
  test("needs a signed-in user", async () => {
    expect((await api.get("/api/money")).status).toBe(401)
    expect((await api.post("/api/money/expenses", undefined, {})).status).toBe(401)
  })

  test("a new person has the built-in categories and euros", async () => {
    const data = await overview()
    expect(data.categories.map((c) => c.key)).toContain("groceries")
    expect(data.categories.every((c) => c.name === null)).toBe(true)
    expect(data.settings).toEqual([{ householdId: null, currency: "EUR" }])
    // Asking again does not add them twice.
    expect((await overview()).categories).toHaveLength(data.categories.length)
  })

  test("the currency can be changed, and only for a space the person is in", async () => {
    const res = await api.request("PUT", "/api/money/settings", olivia, { currency: "USD" })
    expect(res.status).toBe(200)
    expect((await overview()).settings[0]!.currency).toBe("USD")
    expect(
      (await api.request("PUT", "/api/money/settings", olivia, { currency: "XXX" })).status
    ).toBe(400)
    const other = await api.signUp("Eve")
    const { id } = await household(other)
    expect(
      (await api.request("PUT", "/api/money/settings", olivia, { householdId: id, currency: "GBP" })).status
    ).toBe(404)
  })
})

describe("categories", () => {
  test("can be added, renamed and deleted; expenses in them stay without a category", async () => {
    const res = await api.post("/api/money/categories", olivia, { name: "Pets" })
    expect(res.status).toBe(201)
    const { category } = await body<{ category: MoneyCategory }>(res)
    expect(category.name).toBe("Pets")
    const food = await categoryId("groceries")
    expect((await patch(`categories/${food}`, { name: "Food" })).status).toBe(200)
    expect((await overview()).categories.find((c) => c.id === food)).toMatchObject({
      key: "groceries",
      name: "Food",
    })
    const expense = await addExpense({ categoryId: category.id })
    expect((await del(`categories/${category.id}`)).status).toBe(204)
    const after = (await overview()).expenses.find((e) => e.id === expense.id)!
    expect(after.categoryId).toBeNull()
  })

  test("another person's category can't be used or changed", async () => {
    const eve = await api.signUp("Eve")
    const mine = await categoryId("groceries")
    await overview(eve)
    expect((await patch(`categories/${mine}`, { name: "x" }, eve)).status).toBe(404)
    const res = await api.post("/api/money/expenses", eve, {
      amountCents: 100,
      date: "2026-11-20",
      categoryId: mine,
    })
    expect(res.status).toBe(400)
  })
})

describe("expenses", () => {
  test("a new expense is personal and paid by the person", async () => {
    const expense = await addExpense({ note: "Lunch", categoryId: await categoryId("eatingOut") })
    expect(expense).toMatchObject({ amountCents: 1250, note: "Lunch", householdId: null })
    expect(expense.paidBy).toBeTruthy()
    expect((await overview()).expenses).toHaveLength(1)
  })

  test("an amount above zero, a real day and a known payer are needed", async () => {
    const valid = { amountCents: 100, date: "2026-11-20" }
    for (const bad of [
      { ...valid, amountCents: 0 },
      { ...valid, amountCents: -5 },
      { ...valid, amountCents: 12.5 },
      { ...valid, date: "2026-02-30" },
      { date: "2026-11-20" },
      { ...valid, paidBy: "someone-else" },
    ]) {
      expect((await api.post("/api/money/expenses", olivia, bad)).status).toBe(400)
    }
  })

  test("sending the same id twice adds one expense", async () => {
    const first = await addExpense({ id: "e1" })
    const again = await addExpense({ id: "e1", amountCents: 9999 })
    expect(again.id).toBe(first.id)
    expect(again.amountCents).toBe(1250)
    expect((await overview()).expenses).toHaveLength(1)
    const eve = await api.signUp("Eve")
    expect(
      (await api.post("/api/money/expenses", eve, { id: "e1", amountCents: 1, date: "2026-11-20" })).status
    ).toBe(409)
  })

  test("can be changed and deleted", async () => {
    const expense = await addExpense()
    const res = await patch(`expenses/${expense.id}`, { amountCents: 2000, note: "Bigger" })
    expect((await body<{ expense: Expense }>(res)).expense).toMatchObject({
      amountCents: 2000,
      note: "Bigger",
    })
    expect((await del(`expenses/${expense.id}`)).status).toBe(204)
    expect((await del(`expenses/${expense.id}`)).status).toBe(404)
  })

  test("personal expenses are private", async () => {
    const expense = await addExpense()
    const eve = await api.signUp("Eve")
    expect((await overview(eve)).expenses).toHaveLength(0)
    expect((await patch(`expenses/${expense.id}`, { note: "x" }, eve)).status).toBe(404)
    expect((await del(`expenses/${expense.id}`, eve)).status).toBe(404)
  })

  test("household expenses are for every member, with the payer, until they leave", async () => {
    const { id, member } = await household(olivia)
    const expense = await addExpense({ householdId: id })
    expect(expense.householdId).toBe(id)
    expect((await overview(member)).expenses).toHaveLength(1)
    // Sam can pay for it as himself, but not as a stranger.
    const memberId = (await overview(member)).expenses[0]!.paidBy
    expect(memberId).toBe(expense.paidBy)
    const samPays = await api.post("/api/money/expenses", member, {
      householdId: id,
      amountCents: 500,
      date: "2026-11-20",
    })
    expect(samPays.status).toBe(201)
    expect((await overview(olivia)).expenses).toHaveLength(2)
    // A stranger sees nothing and can't add to the household.
    const eve = await api.signUp("Eve")
    expect((await overview(eve)).expenses).toHaveLength(0)
    expect(
      (await api.post("/api/money/expenses", eve, { householdId: id, amountCents: 1, date: "2026-11-20" })).status
    ).toBe(404)
  })

  test("an expense can be split by percentages, or not shared, or paid by the other", async () => {
    const { id, member } = await household(olivia)
    const me = (await addExpense({ householdId: id })).paidBy
    const other = (
      await body<{ expense: Expense }>(
        await api.post("/api/money/expenses", member, {
          householdId: id,
          amountCents: 100,
          date: "2026-11-20",
        })
      )
    ).expense.paidBy

    // Default: no split, which means equally.
    expect((await overview()).expenses[0]!.split).toBeNull()

    const seventy = await addExpense({ householdId: id, split: { [me]: 70, [other]: 30 } })
    expect(seventy.split).toEqual({ [me]: 70, [other]: 30 })

    // Paid by the other, for me only.
    const forMe = await addExpense({ householdId: id, paidBy: other, split: { [me]: 100 } })
    expect(forMe).toMatchObject({ paidBy: other, split: { [me]: 100 } })

    // Change it later, and back to equally.
    expect((await patch(`expenses/${seventy.id}`, { split: { [me]: 100 } })).status).toBe(200)
    expect((await patch(`expenses/${seventy.id}`, { split: null })).status).toBe(200)
    expect((await overview()).expenses.find((e) => e.id === seventy.id)!.split).toBeNull()

    // Must add up to 100, and only members can take part.
    for (const split of [{ [me]: 70, [other]: 20 }, { [me]: 50, stranger: 50 }]) {
      expect(
        (await api.post("/api/money/expenses", olivia, {
          householdId: id,
          amountCents: 100,
          date: "2026-11-20",
          split,
        })).status
      ).toBe(400)
    }
  })

  test("a household category can't be used for a personal expense", async () => {
    const { id } = await household(olivia)
    const shared = (await overview()).categories.find((c) => c.householdId === id)!
    const res = await api.post("/api/money/expenses", olivia, {
      amountCents: 100,
      date: "2026-11-20",
      categoryId: shared.id,
    })
    expect(res.status).toBe(400)
  })
})

describe("budgets", () => {
  test("setting a budget again changes it, one per category", async () => {
    const food = await categoryId("groceries")
    const first = await api.post("/api/money/budgets", olivia, { categoryId: food, amountCents: 30000 })
    expect(first.status).toBe(201)
    await api.post("/api/money/budgets", olivia, { categoryId: food, amountCents: 40000 })
    await api.post("/api/money/budgets", olivia, { categoryId: null, amountCents: 100000 })
    await api.post("/api/money/budgets", olivia, { categoryId: null, amountCents: 120000 })
    const budgets = (await overview()).budgets
    expect(budgets).toHaveLength(2)
    expect(budgets.find((b) => b.categoryId === food)!.amountCents).toBe(40000)
    expect(budgets.find((b) => b.categoryId === null)!.amountCents).toBe(120000)
  })

  test("deleting a category deletes its budget", async () => {
    const category = (
      await body<{ category: MoneyCategory }>(
        await api.post("/api/money/categories", olivia, { name: "Pets" })
      )
    ).category
    await api.post("/api/money/budgets", olivia, { categoryId: category.id, amountCents: 5000 })
    await del(`categories/${category.id}`)
    expect((await overview()).budgets).toHaveLength(0)
  })

  test("a budget needs an amount above zero and a category of the same space", async () => {
    expect((await api.post("/api/money/budgets", olivia, { categoryId: null, amountCents: 0 })).status).toBe(400)
    expect((await api.post("/api/money/budgets", olivia, { categoryId: "nope", amountCents: 5 })).status).toBe(404)
  })

  test("can be deleted", async () => {
    const res = await api.post("/api/money/budgets", olivia, { categoryId: null, amountCents: 5000 })
    const { budget } = await body<{ budget: Budget }>(res)
    expect((await del(`budgets/${budget.id}`)).status).toBe(204)
    expect((await overview()).budgets).toHaveLength(0)
  })
})

describe("bills", () => {
  test("a household bill can be paid by someone else and split", async () => {
    const { id, member } = await household(olivia)
    const other = (
      await body<{ expense: Expense }>(
        await api.post("/api/money/expenses", member, {
          householdId: id,
          amountCents: 100,
          date: "2026-11-20",
        })
      )
    ).expense.paidBy
    const bill = (
      await body<{ bill: Bill }>(
        await api.post("/api/money/bills", olivia, {
          householdId: id,
          title: "Rent",
          amountCents: 90000,
          repeat: "monthly",
          nextDue: "2026-11-30",
        })
      )
    ).bill
    const res = await api.post(`/api/money/bills/${bill.id}/pay`, olivia, {
      expenseId: "pay-split",
      date: "2026-11-30",
      paidBy: other,
      split: { [other]: 30, stranger: 70 },
    })
    expect(res.status).toBe(400)
    const ok = await api.post(`/api/money/bills/${bill.id}/pay`, olivia, {
      expenseId: "pay-split",
      date: "2026-11-30",
      paidBy: other,
      split: { [other]: 100 },
    })
    expect(ok.status).toBe(200)
    expect(
      (await overview()).expenses.find((e) => e.id === "pay-split")
    ).toMatchObject({ paidBy: other, split: { [other]: 100 }, billId: bill.id })
  })

  async function addBill(extra: object = {}) {
    const res = await api.post("/api/money/bills", olivia, {
      title: "Rent",
      amountCents: 90000,
      repeat: "monthly",
      nextDue: "2026-11-30",
      ...extra,
    })
    expect(res.status).toBe(201)
    return (await body<{ bill: Bill }>(res)).bill
  }

  test("paying adds the expense and moves the bill to its next day", async () => {
    const category = await categoryId("home")
    const bill = await addBill({ categoryId: category })
    const res = await api.post(`/api/money/bills/${bill.id}/pay`, olivia, {
      expenseId: "pay-1",
      date: "2026-11-28",
    })
    expect(res.status).toBe(200)
    const paid = await body<{ bill: Bill; expense: Expense }>(res)
    expect(paid.bill.nextDue).toBe("2026-12-30")
    expect(paid.expense).toMatchObject({
      id: "pay-1",
      amountCents: 90000,
      categoryId: category,
      billId: bill.id,
      note: "Rent",
      date: "2026-11-28",
    })
  })

  test("paying twice with the same id pays once", async () => {
    const bill = await addBill()
    const pay = () =>
      api.post(`/api/money/bills/${bill.id}/pay`, olivia, { expenseId: "pay-1", date: "2026-11-28" })
    await pay()
    const again = await body<{ bill: Bill; expense: Expense | null }>(await pay())
    expect(again.expense).toBeNull()
    expect(again.bill.nextDue).toBe("2026-12-30")
    expect((await overview()).expenses).toHaveLength(1)
  })

  test("a monthly bill on the 31st keeps its day", async () => {
    const bill = await addBill({ nextDue: "2026-01-31" })
    const pay = async (id: string, date: string) =>
      (await body<{ bill: Bill }>(await api.post(`/api/money/bills/${bill.id}/pay`, olivia, { expenseId: id, date }))).bill
    expect((await pay("a", "2026-01-31")).nextDue).toBe("2026-02-28")
    expect((await pay("b", "2026-02-28")).nextDue).toBe("2026-03-31")
  })

  test("a bill that does not repeat has no next day once paid", async () => {
    const bill = await addBill({ repeat: "never" })
    const paid = await body<{ bill: Bill }>(
      await api.post(`/api/money/bills/${bill.id}/pay`, olivia, { expenseId: "x", date: "2026-11-28" })
    )
    expect(paid.bill.nextDue).toBeNull()
  })

  test("can be changed, and deleting a bill keeps its expenses", async () => {
    const bill = await addBill()
    await api.post(`/api/money/bills/${bill.id}/pay`, olivia, { expenseId: "x", date: "2026-11-28" })
    const res = await patch(`bills/${bill.id}`, { amountCents: 95000, nextDue: "2027-01-15" })
    expect((await body<{ bill: Bill }>(res)).bill).toMatchObject({ amountCents: 95000, nextDue: "2027-01-15", dayOfMonth: 15 })
    expect((await del(`bills/${bill.id}`)).status).toBe(204)
    const data = await overview()
    expect(data.bills).toHaveLength(0)
    expect(data.expenses[0]!.billId).toBeNull()
  })

  test("are private, and shared in a household", async () => {
    const bill = await addBill()
    const eve = await api.signUp("Eve")
    expect((await api.post(`/api/money/bills/${bill.id}/pay`, eve, { expenseId: "z", date: "2026-11-28" })).status).toBe(404)
    const { id, member } = await household(olivia)
    const shared = await addBill({ householdId: id, title: "Internet" })
    expect((await overview(member)).bills.map((b) => b.id)).toEqual([shared.id])
  })

  test("need a title, an amount and a repeat", async () => {
    const valid = { title: "Rent", amountCents: 100, repeat: "monthly", nextDue: "2026-11-30" }
    for (const bad of [
      { ...valid, title: " " },
      { ...valid, amountCents: 0 },
      { ...valid, repeat: "daily" },
      { ...valid, nextDue: "soon" },
    ]) {
      expect((await api.post("/api/money/bills", olivia, bad)).status).toBe(400)
    }
  })
})

describe("savings", () => {
  async function addGoal(extra: object = {}, cookie = olivia) {
    const res = await api.post("/api/money/savings", cookie, {
      name: "Holiday",
      targetCents: 100000,
      ...extra,
    })
    expect(res.status).toBe(201)
    return (await body<{ goal: SavingsGoal }>(res)).goal
  }

  test("money goes in and out, and sending an id twice counts once", async () => {
    const goal = await addGoal({ targetDate: "2027-06-01" })
    expect(goal.targetDate).toBe("2027-06-01")
    const put = (extra: object) =>
      api.post(`/api/money/savings/${goal.id}/entries`, olivia, { date: "2026-11-21", ...extra })
    expect((await put({ id: "s1", amountCents: 30000 })).status).toBe(201)
    expect((await put({ id: "s1", amountCents: 30000 })).status).toBe(201)
    expect((await put({ id: "s2", amountCents: -5000 })).status).toBe(201)
    const entries = (await overview()).savingsEntries
    expect(entries.map((e) => e.amountCents)).toEqual([30000, -5000])
    expect((await put({ amountCents: 0 })).status).toBe(400)
  })

  test("an entry id of another goal gives a conflict", async () => {
    const a = await addGoal()
    const b = await addGoal({ name: "Car" })
    await api.post(`/api/money/savings/${a.id}/entries`, olivia, { id: "s1", amountCents: 100, date: "2026-11-21" })
    const res = await api.post(`/api/money/savings/${b.id}/entries`, olivia, { id: "s1", amountCents: 100, date: "2026-11-21" })
    expect(res.status).toBe(409)
  })

  test("deleting a goal deletes its entries", async () => {
    const goal = await addGoal()
    await api.post(`/api/money/savings/${goal.id}/entries`, olivia, { amountCents: 100, date: "2026-11-21" })
    expect((await del(`savings/${goal.id}`)).status).toBe(204)
    const data = await overview()
    expect(data.goals).toHaveLength(0)
    expect(data.savingsEntries).toHaveLength(0)
  })

  test("a single entry can be deleted, and goals are private", async () => {
    const goal = await addGoal()
    const eve = await api.signUp("Eve")
    expect((await api.post(`/api/money/savings/${goal.id}/entries`, eve, { amountCents: 100, date: "2026-11-21" })).status).toBe(404)
    await api.post(`/api/money/savings/${goal.id}/entries`, olivia, { id: "s1", amountCents: 100, date: "2026-11-21" })
    expect((await del("savings/entries/s1", eve)).status).toBe(404)
    expect((await del("savings/entries/s1")).status).toBe(204)
    expect((await overview()).savingsEntries).toHaveLength(0)
  })

  test("a goal can be changed and needs a name and a target", async () => {
    const goal = await addGoal()
    const res = await patch(`savings/${goal.id}`, { name: "Trip", targetDate: null })
    expect((await body<{ goal: SavingsGoal }>(res)).goal).toMatchObject({ name: "Trip", targetDate: null })
    for (const bad of [{ name: " ", targetCents: 5 }, { name: "x", targetCents: 0 }]) {
      expect((await api.post("/api/money/savings", olivia, bad)).status).toBe(400)
    }
  })
})
