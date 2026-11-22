import { describe, expect, test } from "bun:test"

import { applyMoneyOp, applyMoneyOps, emptyMoney, type MoneyData, type MoneyOp } from "./money-ops"
import { MoneyStore } from "./money-store"

const base: MoneyData = {
  ...emptyMoney,
  categories: [
    { id: "food", key: "groceries", name: null, householdId: null },
    { id: "fun", key: "fun", name: null, householdId: null },
  ],
}

const addExpense = (extra: Partial<Extract<MoneyOp, { type: "addExpense" }>> = {}): MoneyOp => ({
  type: "addExpense",
  id: "e1",
  amountCents: 1250,
  categoryId: "food",
  date: "2026-11-20",
  note: "",
  paidBy: "me",
  householdId: null,
  ...extra,
})

describe("applyMoneyOp", () => {
  test("an expense is added once, even when sent twice", () => {
    const once = applyMoneyOp(base, addExpense())
    expect(applyMoneyOp(once, addExpense({ amountCents: 1 })).expenses).toEqual(once.expenses)
    expect(once.expenses[0]).toMatchObject({ amountCents: 1250, paidBy: "me", billId: null })
  })

  test("an expense can be changed and removed", () => {
    let data = applyMoneyOp(base, addExpense())
    data = applyMoneyOp(data, { type: "updateExpense", id: "e1", change: { amountCents: 99, note: undefined } })
    expect(data.expenses[0]).toMatchObject({ amountCents: 99, note: "" })
    expect(applyMoneyOp(data, { type: "removeExpense", id: "e1" }).expenses).toHaveLength(0)
  })

  test("deleting a category keeps expenses and bills without a category, and drops its budget", () => {
    let data = applyMoneyOp(base, addExpense())
    data = applyMoneyOp(data, { type: "setBudget", id: "b1", categoryId: "food", amountCents: 100, householdId: null })
    data = applyMoneyOp(data, { type: "setBudget", id: "b2", categoryId: null, amountCents: 500, householdId: null })
    data = applyMoneyOp(data, { type: "removeCategory", id: "food" })
    expect(data.expenses[0]!.categoryId).toBeNull()
    expect(data.budgets.map((b) => b.id)).toEqual(["b2"])
  })

  test("setting a budget again changes the one that is there", () => {
    let data = applyMoneyOp(base, { type: "setBudget", id: "b1", categoryId: "food", amountCents: 100, householdId: null })
    data = applyMoneyOp(data, { type: "setBudget", id: "other", categoryId: "food", amountCents: 250, householdId: null })
    expect(data.budgets).toEqual([{ id: "b1", categoryId: "food", amountCents: 250, householdId: null }])
  })

  test("paying a bill adds the expense and moves the bill, and paying again changes nothing", () => {
    let data = applyMoneyOp(base, {
      type: "addBill",
      id: "rent",
      title: "Rent",
      amountCents: 90000,
      categoryId: "food",
      repeat: "monthly",
      nextDue: "2026-01-31",
      householdId: null,
    })
    const pay: MoneyOp = { type: "payBill", billId: "rent", expenseId: "p1", date: "2026-01-31", paidBy: "me" }
    data = applyMoneyOp(data, pay)
    expect(data.bills[0]!.nextDue).toBe("2026-02-28")
    expect(data.expenses[0]).toMatchObject({ id: "p1", amountCents: 90000, billId: "rent", note: "Rent" })
    expect(applyMoneyOp(data, pay)).toBe(data)
  })

  test("deleting a bill keeps the expenses that paid it", () => {
    let data = applyMoneyOp(base, {
      type: "addBill", id: "rent", title: "Rent", amountCents: 100, repeat: "never", nextDue: "2026-11-30", householdId: null,
    })
    data = applyMoneyOp(data, { type: "payBill", billId: "rent", expenseId: "p1", date: "2026-11-30", paidBy: "me" })
    data = applyMoneyOp(data, { type: "removeBill", id: "rent" })
    expect(data.bills).toHaveLength(0)
    expect(data.expenses[0]!.billId).toBeNull()
  })

  test("savings entries go with their goal", () => {
    let data = applyMoneyOp(base, { type: "addGoal", id: "g", name: "Trip", targetCents: 1000, targetDate: null, householdId: null })
    data = applyMoneyOp(data, { type: "addSavings", id: "s", goalId: "g", amountCents: 500, date: "2026-11-21" })
    data = applyMoneyOp(data, { type: "removeGoal", id: "g" })
    expect(data.goals).toHaveLength(0)
    expect(data.savingsEntries).toHaveLength(0)
  })

  test("the currency is set for one space only", () => {
    let data = applyMoneyOp(base, { type: "setCurrency", householdId: null, currency: "USD" })
    data = applyMoneyOp(data, { type: "setCurrency", householdId: "h", currency: "GBP" })
    data = applyMoneyOp(data, { type: "setCurrency", householdId: null, currency: "CHF" })
    expect(data.settings).toEqual([
      { householdId: null, currency: "CHF" },
      { householdId: "h", currency: "GBP" },
    ])
  })

  test("applying a queue never changes its input", () => {
    const frozen = structuredClone(base)
    applyMoneyOps(base, [addExpense()])
    expect(base).toEqual(frozen)
  })
})

class NetworkError extends Error {
  status = 0
}

function setup() {
  const server = { data: structuredClone(base), reachable: true, sent: [] as MoneyOp[] }
  let device: string | null = null
  const store = new MoneyStore({
    fetchData: async () => {
      if (!server.reachable) throw new NetworkError()
      return structuredClone(server.data)
    },
    send: async (op) => {
      if (!server.reachable) throw new NetworkError()
      server.sent.push(op)
      server.data = applyMoneyOp(server.data, op)
    },
    storage: { read: async () => device, write: async (v) => { device = v } },
  })
  return { store, server, device: () => device }
}

describe("receipts", () => {
  const receipt = {
    id: "r",
    fileId: "f",
    status: "ready" as const,
    shop: "Lidl",
    date: "2026-11-20" as string | null,
    totalCents: 1799 as number | null,
    expenseId: null,
    error: null,
    householdId: null,
    createdAt: "2026-11-20T10:00:00.000Z",
  }
  const withReceipt = (over: object = {}): MoneyData => ({ ...base, receipts: [{ ...receipt, ...over }] })
  const toExpense: MoneyOp = {
    type: "receiptToExpense", id: "r", expenseId: "e1", categoryId: "food", paidBy: "me", date: null,
  }

  test("a receipt becomes an expense with its total, date and shop, once", () => {
    const data = applyMoneyOp(withReceipt(), toExpense)
    expect(data.expenses[0]).toMatchObject({ id: "e1", amountCents: 1799, date: "2026-11-20", note: "Lidl", receiptId: "r" })
    expect(data.receipts[0]!.expenseId).toBe("e1")
    expect(applyMoneyOp(data, toExpense)).toBe(data)
  })

  test("without a total, or without any date, nothing is added", () => {
    const noTotal = withReceipt({ totalCents: null })
    expect(applyMoneyOp(noTotal, toExpense)).toBe(noTotal)
    const noDate = withReceipt({ date: null })
    expect(applyMoneyOp(noDate, toExpense)).toBe(noDate)
    expect(applyMoneyOp(noDate, { ...toExpense, date: "2026-11-18" } as MoneyOp).expenses[0]!.date).toBe("2026-11-18")
  })

  test("correcting changes only what is sent, deleting keeps the expense", () => {
    let data = applyMoneyOp(withReceipt(), { type: "updateReceipt", id: "r", change: { totalCents: 500, shop: undefined } })
    expect(data.receipts[0]).toMatchObject({ totalCents: 500, shop: "Lidl" })
    data = applyMoneyOp(data, toExpense)
    data = applyMoneyOp(data, { type: "removeReceipt", id: "r" })
    expect(data.receipts).toHaveLength(0)
    expect(data.expenses[0]!.receiptId).toBeNull()
  })
})

describe("MoneyStore", () => {
  test("works without a connection and sends the changes when it is back", async () => {
    const { store, server } = setup()
    await store.start()
    server.reachable = false
    store.dispatch(addExpense())
    await store.sync()
    expect(store.getState().data.expenses).toHaveLength(1)
    expect(store.getState().pending).toBe(1)
    expect(store.getState().online).toBe(false)
    server.reachable = true
    await store.sync()
    expect(store.getState().pending).toBe(0)
    expect(store.getState().online).toBe(true)
    expect(server.data.expenses).toHaveLength(1)
  })

  test("changes survive closing the app", async () => {
    const first = setup()
    await first.store.start()
    first.server.reachable = false
    first.store.dispatch(addExpense())
    await first.store.sync()
    await new Promise((r) => setTimeout(r, 0))
    const saved = first.device()
    expect(saved).not.toBeNull()

    const second = new MoneyStore({
      fetchData: async () => { throw new NetworkError() },
      send: async () => { throw new NetworkError() },
      storage: { read: async () => saved, write: async () => {} },
    })
    await second.start()
    expect(second.getState().loaded).toBe(true)
    expect(second.getState().data.expenses).toHaveLength(1)
    expect(second.getState().pending).toBe(1)
  })

  test("a change the server will never accept is forgotten", async () => {
    const store = new MoneyStore({
      fetchData: async () => structuredClone(base),
      send: async () => { throw Object.assign(new Error("gone"), { status: 404 }) },
    })
    await store.start()
    store.dispatch(addExpense())
    await store.sync()
    expect(store.getState().pending).toBe(0)
    expect(store.getState().data.expenses).toHaveLength(0)
  })
})
