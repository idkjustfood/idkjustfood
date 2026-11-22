import { describe, expect, test } from "bun:test"

import { emptyMoney } from "./money-ops"
import { billsByDue, budgetsForMonth, filterExpenses, moneyOfSpace } from "./money-view"

const expense = (id: string, over: object = {}) => ({
  id,
  amountCents: 100,
  categoryId: "food" as string | null,
  date: "2026-11-10",
  note: "",
  paidBy: "me",
  billId: null,
  receiptId: null,
  householdId: null,
  createdAt: `2026-11-10T00:00:0${id}.000Z`,
  ...over,
})

describe("moneyOfSpace", () => {
  test("never mixes personal and household money", () => {
    const data = {
      ...emptyMoney,
      settings: [{ householdId: "h", currency: "GBP" as const }],
      expenses: [expense("1"), expense("2", { householdId: "h" })],
      goals: [
        { id: "g1", name: "A", targetCents: 1, targetDate: null, householdId: null, createdAt: "" },
        { id: "g2", name: "B", targetCents: 1, targetDate: null, householdId: "h", createdAt: "" },
      ],
      savingsEntries: [
        { id: "s1", goalId: "g1", amountCents: 1, date: "2026-11-10" },
        { id: "s2", goalId: "g2", amountCents: 1, date: "2026-11-10" },
      ],
    }
    const mine = moneyOfSpace(data, null)
    expect(mine.expenses.map((e) => e.id)).toEqual(["1"])
    expect(mine.savingsEntries.map((e) => e.id)).toEqual(["s1"])
    expect(mine.currency).toBe("EUR")
    const shared = moneyOfSpace(data, "h")
    expect(shared.expenses.map((e) => e.id)).toEqual(["2"])
    expect(shared.currency).toBe("GBP")
  })
})

describe("filterExpenses", () => {
  const all = [
    expense("1", { note: "Bread" }),
    expense("2", { date: "2026-11-12", categoryId: null, note: "Gift" }),
    expense("3", { date: "2026-10-30" }),
  ]
  const base = { month: "2026-11", categoryId: null, search: "" }

  test("one month, newest first", () => {
    expect(filterExpenses(all, base).map((e) => e.id)).toEqual(["2", "1"])
  })
  test("by category, including none", () => {
    expect(filterExpenses(all, { ...base, categoryId: "food" }).map((e) => e.id)).toEqual(["1"])
    expect(filterExpenses(all, { ...base, categoryId: "none" }).map((e) => e.id)).toEqual(["2"])
  })
  test("by search in the note, ignoring case", () => {
    expect(filterExpenses(all, { ...base, search: " GIFT " }).map((e) => e.id)).toEqual(["2"])
  })
})

describe("budgetsForMonth", () => {
  test("total first, and only this month counts", () => {
    const budgets = [
      { id: "b1", categoryId: "food", amountCents: 1000, householdId: null },
      { id: "b2", categoryId: null, amountCents: 5000, householdId: null },
    ]
    const result = budgetsForMonth(budgets, [expense("1"), expense("3", { date: "2026-10-30" })], "2026-11")
    expect(result.map((r) => r.budgetId)).toEqual(["b2", "b1"])
    expect(result[1]!.spentCents).toBe(100)
  })
})

describe("billsByDue", () => {
  test("by day, paid one-off bills last", () => {
    const sorted = billsByDue([
      { title: "c", nextDue: null },
      { title: "b", nextDue: "2026-12-01" },
      { title: "a", nextDue: "2026-11-01" },
    ])
    expect(sorted.map((b) => b.title)).toEqual(["a", "b", "c"])
  })
})
