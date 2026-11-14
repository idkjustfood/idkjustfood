import { describe, expect, test } from "bun:test"

import type { ShoppingList } from "@workspace/schemas"

import {
  afterError,
  applyOp,
  applyOps,
  planAddItem,
  newId,
  type ShoppingOp,
} from "./shopping-ops"

const list = (id: string, extra: Partial<ShoppingList> = {}): ShoppingList => ({
  id,
  name: id,
  householdId: null,
  userId: "me",
  items: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extra,
})

const milk = {
  id: "m",
  name: "Milk",
  quantity: 1,
  unit: "l",
  note: null,
  checked: false,
  fromRecipes: [],
}

describe("applyOp", () => {
  test("makes a list, once", () => {
    const op: ShoppingOp = {
      type: "createList",
      id: "a",
      name: "Shop",
      householdId: "h",
      userId: "me",
    }
    const once = applyOp([], op)
    expect(once).toMatchObject([
      { id: "a", name: "Shop", householdId: "h", items: [] },
    ])
    expect(applyOp(once, op)).toHaveLength(1)
  })

  test("ticks an item off while offline, without touching the input", () => {
    const lists = [list("a", { items: [milk] })]
    const copy = structuredClone(lists)
    const result = applyOp(lists, {
      type: "updateItem",
      listId: "a",
      itemId: "m",
      change: { checked: true },
    })
    expect(result[0]!.items[0]).toMatchObject({ name: "Milk", checked: true })
    expect(lists).toEqual(copy)
  })

  test("adds an item with an empty amount when none is given", () => {
    const result = applyOp([list("a")], {
      type: "addItem",
      listId: "a",
      item: { id: "x", name: "Salt" },
    })
    expect(result[0]!.items).toEqual([
      {
        id: "x",
        name: "Salt",
        quantity: null,
        unit: null,
        note: null,
        checked: false,
        fromRecipes: [],
      },
    ])
  })

  test("does not add the same item twice", () => {
    const op: ShoppingOp = {
      type: "addItem",
      listId: "a",
      item: { id: "x", name: "Salt" },
    }
    expect(applyOp(applyOp([list("a")], op), op)[0]!.items).toHaveLength(1)
  })

  test("removes items, clears ticked ones, renames and deletes", () => {
    const base = [
      list("a", {
        items: [milk, { ...milk, id: "n", name: "Eggs", checked: true }],
      }),
      list("b"),
    ]
    expect(
      applyOp(base, {
        type: "removeItem",
        listId: "a",
        itemId: "m",
      })[0]!.items.map((i) => i.id)
    ).toEqual(["n"])
    expect(
      applyOp(base, { type: "clearChecked", listId: "a" })[0]!.items.map(
        (i) => i.id
      )
    ).toEqual(["m"])
    expect(
      applyOp(base, { type: "renameList", listId: "b", name: "New" })[1]!.name
    ).toBe("New")
    expect(
      applyOp(base, { type: "deleteList", listId: "a" }).map((l) => l.id)
    ).toEqual(["b"])
  })

  test("ignores changes to a list or item that is gone", () => {
    const base = [list("a", { items: [milk] })]
    expect(
      applyOp(base, {
        type: "updateItem",
        listId: "zzz",
        itemId: "m",
        change: { checked: true },
      })
    ).toEqual(base)
    expect(
      applyOp(base, {
        type: "updateItem",
        listId: "a",
        itemId: "zzz",
        change: { checked: true },
      })
    ).toEqual(base)
  })
})

describe("applyOps", () => {
  test("puts waiting changes on top of what the server said, in order", () => {
    const server = [list("a", { items: [milk] })]
    const queue: ShoppingOp[] = [
      {
        type: "updateItem",
        listId: "a",
        itemId: "m",
        change: { checked: true },
      },
      { type: "addItem", listId: "a", item: { id: "e", name: "Eggs" } },
      {
        type: "updateItem",
        listId: "a",
        itemId: "e",
        change: { checked: true },
      },
    ]
    const result = applyOps(server, queue)
    expect(result[0]!.items.map((i) => [i.name, i.checked])).toEqual([
      ["Milk", true],
      ["Eggs", true],
    ])
  })

  test("a change to a list the server no longer has is dropped quietly", () => {
    const queue: ShoppingOp[] = [
      { type: "addItem", listId: "gone", item: { id: "e", name: "Eggs" } },
    ]
    expect(applyOps([], queue)).toEqual([])
  })
})

describe("afterError", () => {
  test("keeps changes for later when the server could not be reached", () => {
    expect(afterError(0)).toBe("retry-later")
    expect(afterError(503)).toBe("retry-later")
    expect(afterError(401)).toBe("retry-later")
  })

  test("drops changes the server will never accept", () => {
    expect(afterError(404)).toBe("drop")
    expect(afterError(403)).toBe("drop")
    expect(afterError(400)).toBe("drop")
  })
})

describe("newId", () => {
  test("gives different ids", () => {
    const ids = new Set(Array.from({ length: 200 }, newId))
    expect(ids.size).toBe(200)
  })
})

describe("planAddItem", () => {
  const flour = { ...milk, id: "f", name: "Flour", quantity: 200, unit: "g" }
  const base = list("a", {
    items: [
      flour,
      { ...milk, id: "o", name: "Olivenöl", quantity: null, unit: null },
    ],
  })

  test("adds a new line", () => {
    expect(planAddItem(base, { name: "Eggs", quantity: 6 }, "x")).toEqual({
      type: "addItem",
      listId: "a",
      item: { id: "x", name: "Eggs", quantity: 6 },
    })
  })

  test("adds up the same ingredient with an absolute amount", () => {
    expect(
      planAddItem(base, { name: "flour", quantity: 100, unit: "grams" }, "x")
    ).toEqual({
      type: "updateItem",
      listId: "a",
      itemId: "f",
      change: { quantity: 300 },
    })
  })

  test("the same item without an amount is not added twice", () => {
    expect(planAddItem(base, { name: "olivenöl" }, "x")).toBeNull()
  })

  test("an amount and no amount stay separate lines", () => {
    expect(planAddItem(base, { name: "Flour" }, "x")?.type).toBe("addItem")
  })
})
