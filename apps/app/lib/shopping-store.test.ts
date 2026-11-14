import { describe, expect, test } from "bun:test"

import type { ShoppingList } from "@workspace/schemas"

import type { ShoppingOp } from "./shopping-ops"
import { ShoppingStore } from "./shopping-store"

const milk = {
  id: "m",
  name: "Milk",
  quantity: null,
  unit: null,
  note: null,
  checked: false,
  fromRecipes: [],
}
const weekly: ShoppingList = {
  id: "w",
  name: "Weekly",
  householdId: "h",
  userId: "me",
  items: [milk],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

class NetworkError extends Error {
  status = 0
}
class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
  }
}

/** A fake server and device storage, so the store can be tested without a network. */
function setup(initialDevice?: string) {
  const server = {
    lists: [weekly] as ShoppingList[],
    reachable: true,
    sent: [] as ShoppingOp[],
  }
  let device: string | null = initialDevice ?? null
  const store = new ShoppingStore({
    fetchLists: async () => {
      if (!server.reachable) throw new NetworkError()
      return structuredClone(server.lists)
    },
    send: async (op) => {
      if (!server.reachable) throw new NetworkError()
      server.sent.push(op)
      if (op.type === "updateItem") {
        const item = server.lists[0]!.items.find((i) => i.id === op.itemId)
        if (!item) throw new HttpError(404)
        Object.assign(item, op.change)
      }
    },
    addRecipe: async () => weekly,
    storage: {
      read: async () => device,
      write: async (value) => {
        device = value
      },
    },
  })
  return { server, store, device: () => device }
}

const tick = (id = "m", checked = true): ShoppingOp => ({
  type: "updateItem",
  listId: "w",
  itemId: id,
  change: { checked },
})

describe("ShoppingStore", () => {
  test("loads the lists from the server", async () => {
    const { store } = setup()
    await store.start()
    expect(store.getState()).toMatchObject({
      loaded: true,
      online: true,
      pending: 0,
    })
    expect(store.getState().lists).toHaveLength(1)
  })

  test("without a connection, saved lists are still shown and changes are kept", async () => {
    const online = setup()
    await online.store.start()

    // Closed and opened again in airplane mode.
    const offline = setup(online.device() ?? undefined)
    offline.server.reachable = false
    await offline.store.start()
    expect(offline.store.getState()).toMatchObject({
      loaded: true,
      online: false,
    })
    expect(offline.store.getState().lists[0]!.name).toBe("Weekly")

    offline.store.dispatch(tick())
    await offline.store.sync()
    const state = offline.store.getState()
    expect(state.pending).toBe(1)
    expect(state.lists[0]!.items[0]!.checked).toBe(true)
    expect(offline.server.sent).toEqual([])
  })

  test("changes made offline reach the server when the connection returns", async () => {
    const { store, server } = setup()
    await store.start()
    server.reachable = false
    store.dispatch(tick())
    store.dispatch({
      type: "addItem",
      listId: "w",
      item: { id: "e", name: "Eggs" },
    })
    await store.sync()
    expect(store.getState()).toMatchObject({ pending: 2, online: false })

    server.reachable = true
    await store.sync()
    expect(store.getState()).toMatchObject({ pending: 0, online: true })
    expect(server.sent.map((op) => op.type)).toEqual(["updateItem", "addItem"])
    expect(server.lists[0]!.items[0]!.checked).toBe(true)
  })

  test("waiting changes survive closing the app", async () => {
    const first = setup()
    await first.store.start()
    first.server.reachable = false
    first.store.dispatch(tick())
    await first.store.sync()

    const second = setup(first.device() ?? undefined)
    second.server.reachable = false
    await second.store.start()
    expect(second.store.getState().pending).toBe(1)
    expect(second.store.getState().lists[0]!.items[0]!.checked).toBe(true)

    second.server.reachable = true
    await second.store.sync()
    expect(second.store.getState().pending).toBe(0)
    expect(second.server.lists[0]!.items[0]!.checked).toBe(true)
  })

  test("a change the server rejects is dropped and does not block the rest", async () => {
    const { store, server } = setup()
    await store.start()
    store.dispatch(tick("gone"))
    store.dispatch(tick("m"))
    await store.sync()
    expect(store.getState().pending).toBe(0)
    expect(server.lists[0]!.items[0]!.checked).toBe(true)
  })

  test("nothing is sent while paused, and it is sent after", async () => {
    const { store, server } = setup()
    await store.start()
    store.setPaused(true)
    store.dispatch(tick())
    await store.sync()
    expect(server.sent).toEqual([])
    expect(store.getState()).toMatchObject({ online: false, pending: 1 })

    store.setPaused(false)
    await store.sync()
    expect(store.getState()).toMatchObject({ online: true, pending: 0 })
  })

  test("adding a recipe needs a connection", async () => {
    const { store, server } = setup()
    await store.start()
    server.reachable = false
    await store.sync()
    await expect(store.addRecipe("w", "r")).rejects.toThrow("connection")
  })

  test("a failing server keeps the last lists and says why", async () => {
    const { store } = setup()
    await store.start()
    const broken = new ShoppingStore({
      fetchLists: async () => {
        throw new HttpError(500)
      },
      send: async () => {},
      addRecipe: async () => weekly,
      initial: undefined,
    })
    await broken.start()
    expect(broken.getState().error).toBe("HTTP 500")
    expect(store.getState().lists).toHaveLength(1)
  })
})
