import { describe, expect, test } from "bun:test"

import {
  balances,
  ExpenseSplitSchema,
  splitCentsBy,
  budgetProgress,
  cleanReading,
  dueAfterPaying,
  dueBills,
  monthlySavingsNeeded,
  nextDueDate,
  parseCents,
  savingsProgress,
  settleUp,
  splitCents,
  splitReceipt,
  spendingByCategory,
  sumCents,
} from "./money.js"

describe("parseCents", () => {
  test("reads what people type", () => {
    expect(parseCents("12")).toBe(1200)
    expect(parseCents("12,50")).toBe(1250)
    expect(parseCents("12.5")).toBe(1250)
    expect(parseCents("0,05")).toBe(5)
    expect(parseCents("1.234,56")).toBe(123456)
    expect(parseCents("1,234.56")).toBe(123456)
    expect(parseCents("1,234")).toBe(123400)
    expect(parseCents(" 7 ")).toBe(700)
  })

  test("says no instead of guessing", () => {
    for (const bad of ["", "abc", "-5", "12,5,5", "1.2.3,4", "12.", "€5"]) {
      expect(parseCents(bad)).toBeNull()
    }
  })

  test("adds without rounding errors", () => {
    expect(sumCents([{ amountCents: parseCents("0.10")! }, { amountCents: parseCents("0.20")! }])).toBe(30)
  })
})

describe("splitCents", () => {
  test("parts always add up", () => {
    expect(splitCents(100, 3)).toEqual([34, 33, 33])
    expect(splitCents(1, 4)).toEqual([1, 0, 0, 0])
    for (const total of [0, 1, 99, 1001]) {
      for (const parts of [1, 2, 3, 7]) {
        expect(sumCents(splitCents(total, parts).map((amountCents) => ({ amountCents })))).toBe(total)
      }
    }
  })
})

describe("balances", () => {
  test("the payer is owed the other parts", () => {
    const result = balances([{ amountCents: 3000, paidBy: "a" }], ["a", "b", "c"])
    expect(result.get("a")).toBe(2000)
    expect(result.get("b")).toBe(-1000)
    expect(result.get("c")).toBe(-1000)
  })

  test("balances always add up to zero, also with odd cents", () => {
    const result = balances(
      [
        { amountCents: 100, paidBy: "a" },
        { amountCents: 101, paidBy: "b" },
        { amountCents: 7, paidBy: "c" },
      ],
      ["a", "b", "c"]
    )
    expect([...result.values()].reduce((x, y) => x + y, 0)).toBe(0)
  })

  test("settling up clears every balance", () => {
    const result = balances(
      [
        { amountCents: 3000, paidBy: "a" },
        { amountCents: 900, paidBy: "b" },
      ],
      ["a", "b", "c"]
    )
    const payments = settleUp(result)
    const after = new Map(result)
    for (const p of payments) {
      after.set(p.from, after.get(p.from)! + p.cents)
      after.set(p.to, after.get(p.to)! - p.cents)
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true)
    expect(payments.length).toBeLessThanOrEqual(2)
  })

  test("a 70/30 split makes the payer owed 30 %", () => {
    const result = balances(
      [{ amountCents: 10000, paidBy: "a", split: { a: 70, b: 30 } }],
      ["a", "b"]
    )
    expect(result.get("a")).toBe(3000)
    expect(result.get("b")).toBe(-3000)
  })

  test("an expense that is not shared changes nothing", () => {
    const result = balances(
      [{ amountCents: 4500, paidBy: "a", split: { a: 100 } }],
      ["a", "b"]
    )
    expect(result.get("a")).toBe(0)
    expect(result.get("b")).toBe(0)
  })

  test("paid by the other for me: I owe it all", () => {
    const result = balances(
      [{ amountCents: 4500, paidBy: "b", split: { a: 100 } }],
      ["a", "b"]
    )
    expect(result.get("a")).toBe(-4500)
    expect(result.get("b")).toBe(4500)
  })

  test("uneven splits still add up to zero", () => {
    const result = balances(
      [{ amountCents: 1001, paidBy: "a", split: { a: 33, b: 33, c: 34 } }],
      ["a", "b", "c"]
    )
    expect([...result.values()].reduce((x, y) => x + y, 0)).toBe(0)
  })

  test("an expense shared with a non-member is ignored", () => {
    const result = balances(
      [{ amountCents: 500, paidBy: "a", split: { a: 50, x: 50 } }],
      ["a", "b"]
    )
    expect(result.get("a")).toBe(0)
  })

  test("splitCentsBy keeps every cent", () => {
    expect(splitCentsBy(1001, [70, 30])).toEqual([701, 300])
    expect(splitCentsBy(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(splitCentsBy(5, [100])).toEqual([5])
  })

  test("the split must add up to 100", () => {
    expect(ExpenseSplitSchema.safeParse({ a: 70, b: 30 }).success).toBe(true)
    expect(ExpenseSplitSchema.safeParse({ a: 70, b: 20 }).success).toBe(false)
    expect(ExpenseSplitSchema.safeParse({}).success).toBe(false)
  })

  test("expenses of people who are not members are ignored", () => {
    expect(balances([{ amountCents: 500, paidBy: "x" }], ["a", "b"]).get("a")).toBe(0)
  })
})

describe("budgets", () => {
  const expenses = [
    { categoryId: "food", amountCents: 5000 },
    { categoryId: "food", amountCents: 3000 },
    { categoryId: "fun", amountCents: 2000 },
    { categoryId: null, amountCents: 500 },
  ]

  test("a category budget counts only its category", () => {
    const p = budgetProgress({ id: "b", categoryId: "food", amountCents: 10000 }, expenses)
    expect(p.spentCents).toBe(8000)
    expect(p.leftCents).toBe(2000)
    expect(p.state).toBe("nearly")
  })

  test("the total budget counts everything", () => {
    const p = budgetProgress({ id: "b", categoryId: null, amountCents: 20000 }, expenses)
    expect(p.spentCents).toBe(10500)
    expect(p.state).toBe("ok")
  })

  test("over means more than the budget, exactly the budget is not over", () => {
    expect(budgetProgress({ id: "b", categoryId: "food", amountCents: 8000 }, expenses).state).toBe("nearly")
    const over = budgetProgress({ id: "b", categoryId: "food", amountCents: 7999 }, expenses)
    expect(over.state).toBe("over")
    expect(over.leftCents).toBe(-1)
  })

  test("spending per category, biggest first", () => {
    expect(spendingByCategory(expenses)[0]).toEqual({ categoryId: "food", cents: 8000 })
  })
})

describe("bills", () => {
  test("repeat on the same day of the month, also after a short month", () => {
    expect(nextDueDate("2026-01-31", "monthly")).toBe("2026-02-28")
    expect(nextDueDate("2026-02-28", "monthly", 31)).toBe("2026-03-31")
    expect(nextDueDate("2028-01-31", "monthly")).toBe("2028-02-29")
    expect(nextDueDate("2026-11-15", "monthly")).toBe("2026-12-15")
    expect(nextDueDate("2026-12-15", "monthly")).toBe("2027-01-15")
  })

  test("weekly, quarterly, yearly and never", () => {
    expect(nextDueDate("2026-11-21", "weekly")).toBe("2026-11-28")
    expect(nextDueDate("2026-11-30", "quarterly")).toBe("2027-02-28")
    expect(nextDueDate("2028-02-29", "yearly")).toBe("2029-02-28")
    expect(nextDueDate("2026-11-21", "never")).toBeNull()
  })

  test("paying a very late bill skips periods that are already over", () => {
    const bill = { nextDue: "2026-08-10", repeat: "monthly" as const, dayOfMonth: 10 }
    expect(dueAfterPaying(bill, "2026-11-21")).toBe("2026-12-10")
    expect(dueAfterPaying(bill, "2026-08-10")).toBe("2026-09-10")
    expect(dueAfterPaying({ ...bill, repeat: "never" }, "2026-11-21")).toBeNull()
  })

  test("due bills are today or earlier, most overdue first", () => {
    const bills = [
      { id: "a", nextDue: "2026-11-21" },
      { id: "b", nextDue: "2026-11-01" },
      { id: "c", nextDue: "2026-11-22" },
      { id: "d", nextDue: null },
    ]
    expect(dueBills(bills, "2026-11-21").map((b) => b.id)).toEqual(["b", "a"])
  })
})

describe("savings", () => {
  const goal = { id: "g", targetCents: 100000 }

  test("saved is the sum of what went in and out, and never below zero", () => {
    const entries = [
      { goalId: "g", amountCents: 30000 },
      { goalId: "g", amountCents: -5000 },
      { goalId: "other", amountCents: 99999 },
    ]
    const p = savingsProgress(goal, entries)
    expect(p.savedCents).toBe(25000)
    expect(p.missingCents).toBe(75000)
    expect(p.share).toBe(0.25)
    expect(savingsProgress(goal, [{ goalId: "g", amountCents: -100 }]).savedCents).toBe(0)
  })

  test("a reached goal has nothing missing and a share of 1", () => {
    const p = savingsProgress(goal, [{ goalId: "g", amountCents: 150000 }])
    expect(p.reached).toBe(true)
    expect(p.share).toBe(1)
    expect(p.missingCents).toBe(0)
  })

  test("the monthly amount rounds up so the goal is reached in time", () => {
    const progress = { missingCents: 100000, reached: false }
    // November 2026 to February 2027 is four months, counting this one.
    expect(monthlySavingsNeeded({ targetDate: "2027-02-15" }, progress, "2026-11-21")).toBe(25000)
    expect(monthlySavingsNeeded({ targetDate: "2027-02-15" }, { missingCents: 100001, reached: false }, "2026-11-21")).toBe(25001)
    expect(monthlySavingsNeeded({ targetDate: "2026-11-30" }, progress, "2026-11-21")).toBe(100000)
  })

  test("no amount without a day, after the day, or when reached", () => {
    const progress = { missingCents: 100, reached: false }
    expect(monthlySavingsNeeded({ targetDate: null }, progress, "2026-11-21")).toBeNull()
    expect(monthlySavingsNeeded({ targetDate: "2026-11-01" }, progress, "2026-11-21")).toBeNull()
    expect(monthlySavingsNeeded({ targetDate: "2027-01-01" }, { missingCents: 0, reached: true }, "2026-11-21")).toBeNull()
  })
})

describe("receipt readings", () => {
  test("keep what is sensible and drop the rest", () => {
    expect(cleanReading({ shop: "  Lidl ", date: "2026-11-20", totalCents: 1799 })).toEqual({
      shop: "Lidl",
      date: "2026-11-20",
      totalCents: 1799,
      items: [],
    })
    expect(cleanReading({ shop: " ", date: "2026-02-30", totalCents: -5 })).toEqual({
      shop: null,
      date: null,
      totalCents: null,
      items: [],
    })
    expect(cleanReading({ shop: null, date: null, totalCents: 0 }).totalCents).toBeNull()
  })
})

describe("splitReceipt", () => {
  const item = (id: string, amountCents: number, categoryId: string | null) => ({
    id,
    name: id,
    amountCents,
    categoryId,
  })

  test("without lines it is one expense with the total", () => {
    expect(splitReceipt({ totalCents: 1500, items: [] }, "food", "e")).toEqual([
      { id: "e", categoryId: "food", amountCents: 1500 },
    ])
  })

  test("groceries and snacks become two expenses, uncategorized lines use the default", () => {
    const items = [item("a", 1000, null), item("b", 300, "snack"), item("c", 200, "snack")]
    expect(splitReceipt({ totalCents: 1500, items }, "food", "e")).toEqual([
      { id: "e", categoryId: "food", amountCents: 1000 },
      { id: "e-2", categoryId: "snack", amountCents: 500 },
    ])
  })

  test("a discount lowers its category", () => {
    const items = [item("a", 1000, "food"), item("b", -100, "food")]
    expect(splitReceipt({ totalCents: 900, items }, null, "e")).toEqual([
      { id: "e", categoryId: "food", amountCents: 900 },
    ])
  })

  test("lines that do not add up to the total are refused, not guessed", () => {
    expect(splitReceipt({ totalCents: 1600, items: [item("a", 1500, "food")] }, null, "e")).toBeNull()
    expect(splitReceipt({ totalCents: null, items: [] }, null, "e")).toBeNull()
    const negative = [item("a", 1000, "food"), item("b", -50, "snack"), item("c", 50, "food")]
    expect(splitReceipt({ totalCents: 1000, items: negative }, null, "e")).toBeNull()
  })
})
