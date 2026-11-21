import { describe, expect, test } from "bun:test"

import type { Meal } from "@workspace/schemas"

import {
  choreItems,
  mealItems,
  shoppingItems,
  timeline,
  todaySections,
} from "./today"

const meal = (id: string, date: string, slot: Meal["slot"]): Meal => ({
  id,
  date,
  slot,
  servings: 2,
  prep: null,
  recipe: {
    id: `r-${id}`,
    title: `Recipe ${id}`,
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    calories: null,
  },
})

describe("today timeline", () => {
  test("shows only today's meals, in the order of the day", () => {
    const items = mealItems(
      [
        meal("a", "2026-01-02", "breakfast"),
        meal("b", "2026-01-01", "afternoon"),
        meal("c", "2026-01-01", "breakfast"),
      ],
      "2026-01-01"
    )
    expect(items.map((i) => i.id)).toEqual(["c", "b"])
  })

  test("lists with nothing left to buy are left out", () => {
    const items = shoppingItems([
      { id: "1", name: "Weekly", items: [{ checked: false }, { checked: true }] },
      { id: "2", name: "Done", items: [{ checked: true }] },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ listId: "1", open: 1 })
  })

  test("meals come before shopping", () => {
    const all = timeline(
      [
        ...shoppingItems([{ id: "1", name: "L", items: [{ checked: false }] }]),
        ...mealItems([meal("a", "2026-01-01", "midday")], "2026-01-01"),
      ],
      []
    )
    expect(all.map((i) => i.kind)).toEqual(["meal", "shopping"])
  })

  test("items of switched-off modules are dropped", () => {
    const all = timeline(
      [
        ...shoppingItems([{ id: "1", name: "L", items: [{ checked: false }] }]),
        ...mealItems([meal("a", "2026-01-01", "midday")], "2026-01-01"),
      ],
      ["shopping"]
    )
    expect(all.map((i) => i.kind)).toEqual(["meal"])
  })

  test("items are grouped into sections, in a fixed order", () => {
    const sections = todaySections(
      timeline(
        [
          ...shoppingItems([
            { id: "1", name: "L", items: [{ checked: false }] },
          ]),
          ...mealItems(
            [meal("a", "2026-01-01", "midday"), meal("b", "2026-01-01", "breakfast")],
            "2026-01-01"
          ),
        ],
        []
      )
    )
    expect(sections.map((s) => s.id)).toEqual(["meals", "shopping"])
    expect(sections[0].items.map((i) => i.id)).toEqual(["b", "a"])
  })

  test("a section without items is not shown", () => {
    const sections = todaySections(
      shoppingItems([{ id: "1", name: "L", items: [{ checked: false }] }])
    )
    expect(sections.map((s) => s.id)).toEqual(["shopping"])
    expect(todaySections([])).toEqual([])
  })

  describe("chores", () => {
    const chore = (
      id: string,
      lastDoneOn: string | null,
      intervalDays = 3,
      name = id
    ) => ({ id, name, intervalDays, lastDoneOn })

    test("shows chores that are due today or overdue, not the ones that wait", () => {
      const items = choreItems(
        [
          chore("never", null),
          chore("today", "2026-01-01", 3),
          chore("overdue", "2025-12-25", 3),
          chore("waiting", "2026-01-03", 3),
        ],
        "2026-01-04"
      )
      expect(items.map((i) => i.id)).toEqual(["overdue", "never", "today"])
    })

    test("overdue chores say how many days late they are and come first", () => {
      const items = choreItems(
        [chore("a", "2026-01-01", 3, "A"), chore("b", "2025-12-30", 3, "B")],
        "2026-01-05"
      )
      expect(items[0]).toMatchObject({ id: "b", overdueDays: 3 })
      expect(items[1]).toMatchObject({ id: "a", overdueDays: 1 })
    })

    test("a chore due today, or never checked, is not overdue", () => {
      const items = choreItems(
        [chore("never", null), chore("today", "2026-01-01", 3)],
        "2026-01-04"
      )
      expect(items.every((i) => i.kind === "chore" && i.overdueDays === 0)).toBe(
        true
      )
    })

    test("chores get their own section, after meals and shopping", () => {
      const sections = todaySections(
        timeline(
          [
            ...choreItems([chore("c", null)], "2026-01-01"),
            ...shoppingItems([
              { id: "1", name: "L", items: [{ checked: false }] },
            ]),
            ...mealItems([meal("a", "2026-01-01", "midday")], "2026-01-01"),
          ],
          []
        )
      )
      expect(sections.map((s) => s.id)).toEqual(["meals", "shopping", "tasks"])
    })

    test("chores of a switched-off module are dropped", () => {
      const all = timeline(choreItems([chore("c", null)], "2026-01-01"), [
        "chores",
      ])
      expect(all).toEqual([])
    })
  })
})
