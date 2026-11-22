import { describe, expect, test } from "bun:test"

import type { Meal } from "@workspace/schemas"

import {
  billItems,
  calendarItems,
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

    test("maintenance, plants and pets show up as tasks of their own module", () => {
      const items = choreItems(
        [
          { ...chore("a", null), kind: "maintenance" as const },
          { ...chore("b", null), kind: "plant" as const },
          { ...chore("c", null), kind: "pet" as const },
          chore("d", null),
        ],
        "2026-01-01"
      )
      expect(items.map((i) => i.moduleId)).toEqual([
        "maintenance",
        "plants",
        "pets",
        "chores",
      ])
      expect(todaySections(items).map((s) => s.id)).toEqual(["tasks"])
    })

    test("switching off plants hides plant tasks only", () => {
      const all = timeline(
        choreItems(
          [{ ...chore("a", null), kind: "plant" as const }, chore("b", null)],
          "2026-01-01"
        ),
        ["plants"]
      )
      expect(all.map((i) => i.id)).toEqual(["b"])
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

  describe("calendar", () => {
    const entry = (
      id: string,
      date: string,
      householdId: string | null = null
    ) => ({ id, title: `Entry ${id}`, color: "sky" as const, date, householdId })
    const chore = (id: string, lastDoneOn: string | null) => ({
      id,
      name: id,
      intervalDays: 3,
      lastDoneOn,
    })
    const today = "2026-11-21"

    test("shows today's and tomorrow's entries, and nothing from other days", () => {
      const items = calendarItems(
        [
          entry("yesterday", "2026-11-20"),
          entry("today", "2026-11-21"),
          entry("tomorrow", "2026-11-22"),
          entry("later", "2026-11-23"),
        ],
        today
      )
      expect(items.map((i) => i.kind === "calendar" && [i.id, i.day])).toEqual([
        ["today", "today"],
        ["tomorrow", "tomorrow"],
      ])
    })

    test("tomorrow rolls over the end of a month and a year", () => {
      const items = calendarItems([entry("new-year", "2027-01-01")], "2026-12-31")
      expect(items[0]).toMatchObject({ id: "new-year", day: "tomorrow" })
    })

    test("personal and household entries are shown together and keep their owner", () => {
      const items = calendarItems(
        [entry("mine", today), entry("ours", today, "home")],
        today
      )
      expect(
        items.map((i) => i.kind === "calendar" && i.householdId)
      ).toEqual([null, "home"])
    })

    test("tomorrow only brings calendar entries: tomorrow's chores and meals are not shown", () => {
      const sections = todaySections(
        timeline(
          [
            ...calendarItems([entry("t", "2026-11-22")], today),
            ...choreItems([chore("c", "2026-11-19")], "2026-11-21"),
            ...mealItems([meal("a", "2026-11-22", "midday")], today),
          ],
          []
        )
      )
      expect(sections.map((s) => s.id)).toEqual(["tomorrow"])
    })

    test("sections run calendar, meals, shopping, tasks, tomorrow", () => {
      const sections = todaySections(
        timeline(
          [
            ...choreItems([chore("c", null)], today),
            ...calendarItems([entry("t", "2026-11-22"), entry("n", today)], today),
            ...mealItems([meal("a", today, "midday")], today),
          ],
          []
        )
      )
      expect(sections.map((s) => s.id)).toEqual([
        "calendar",
        "meals",
        "tasks",
        "tomorrow",
      ])
    })

    test("entries of a switched-off calendar are dropped", () => {
      expect(
        timeline(calendarItems([entry("n", today)], today), ["calendar"])
      ).toEqual([])
    })
  })
})

describe("bills on today", () => {
  const bill = (id: string, nextDue: string | null, amountCents = 1000) => ({
    id,
    title: `Bill ${id}`,
    amountCents,
    nextDue,
  })

  test("shows bills due today or overdue, the most overdue first", () => {
    const items = billItems(
      [bill("a", "2026-11-21"), bill("b", "2026-11-18"), bill("c", "2026-11-22"), bill("d", null)],
      "2026-11-21"
    )
    expect(items.map((i) => i.id)).toEqual(["b", "a"])
    expect(items.map((i) => (i.kind === "bill" ? i.overdueDays : -1))).toEqual([3, 0])
  })

  test("have their own section after tasks, and go away when Bills is switched off", () => {
    const items = billItems([bill("a", "2026-11-21")], "2026-11-21")
    expect(todaySections(items).map((s) => s.id)).toEqual(["bills"])
    expect(timeline(items, ["bills"])).toEqual([])
  })
})
