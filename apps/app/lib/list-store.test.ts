import { describe, expect, test } from "bun:test"

import {
  applyListOp,
  applyListOps,
  ListStore,
  type ListItem,
  type ListOp,
} from "./list-store"

type Thing = ListItem & { name: string; place: string }

const drill: Thing = {
  id: "d",
  name: "Drill",
  place: "Garage",
  householdId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

class NetworkError extends Error {
  status = 0
}

function setup(initialDevice?: string) {
  const server = { items: [drill] as Thing[], reachable: true, sent: [] as ListOp<Thing>[] }
  let device: string | null = initialDevice ?? null
  const store = new ListStore<Thing>({
    fetchItems: async () => {
      if (!server.reachable) throw new NetworkError()
      return structuredClone(server.items)
    },
    send: async (op) => {
      if (!server.reachable) throw new NetworkError()
      server.sent.push(op)
      server.items = applyListOp(server.items, op)
    },
    storage: {
      read: async () => device,
      write: async (value) => {
        device = value
      },
    },
  })
  return { store, server, device: () => device }
}

const add = (id: string, name: string, householdId: string | null = null): ListOp<Thing> => ({
  type: "add",
  item: { id, name, place: "", householdId },
})

describe("applyListOp", () => {
  test("add makes a personal or household item, and the same id twice does nothing", () => {
    const once = applyListOp([], add("a", "Candles", "h"))
    expect(once[0]).toMatchObject({ id: "a", name: "Candles", householdId: "h" })
    expect(applyListOp(once, add("a", "Other"))).toHaveLength(1)
  })

  test("update changes only the fields that are given", () => {
    const [changed] = applyListOp([drill], {
      type: "update",
      id: "d",
      change: { place: "Shed", name: undefined },
    })
    expect(changed).toMatchObject({ name: "Drill", place: "Shed" })
  })

  test("remove drops the item, and an unknown id does nothing", () => {
    expect(applyListOp([drill], { type: "remove", id: "d" })).toEqual([])
    expect(applyListOp([drill], { type: "remove", id: "x" })).toEqual([drill])
  })

  test("never changes its input", () => {
    const items = [drill]
    applyListOps(items, [add("a", "A"), { type: "remove", id: "d" }])
    expect(items).toEqual([drill])
  })
})

describe("ListStore", () => {
  test("loads the items from the server", async () => {
    const { store } = setup()
    await store.start()
    expect(store.getState()).toMatchObject({ loaded: true, online: true, pending: 0 })
    expect(store.getState().items).toEqual([drill])
  })

  test("a change shows at once and is sent", async () => {
    const { store, server } = setup()
    await store.start()
    store.dispatch(add("a", "Candles"))
    expect(store.getState().items.map((i) => i.name)).toContain("Candles")
    await store.sync()
    expect(server.sent).toHaveLength(1)
    expect(store.getState().pending).toBe(0)
  })

  test("offline: changes wait, show right away and are sent when the server is back", async () => {
    const { store, server } = setup()
    await store.start()
    server.reachable = false
    store.dispatch(add("a", "Candles"))
    await store.sync()
    expect(store.getState()).toMatchObject({ online: false, pending: 1 })
    expect(store.getState().items.map((i) => i.id)).toEqual(["d", "a"])
    server.reachable = true
    await store.sync()
    expect(store.getState()).toMatchObject({ online: true, pending: 0 })
    expect(server.items.map((i) => i.id)).toEqual(["d", "a"])
  })

  test("waiting changes survive closing the app", async () => {
    const first = setup()
    await first.store.start()
    first.server.reachable = false
    first.store.dispatch(add("a", "Candles"))
    await first.store.sync()
    const second = setup(first.device()!)
    second.server.reachable = false
    await second.store.start()
    expect(second.store.getState().loaded).toBe(true)
    expect(second.store.getState().pending).toBe(1)
    expect(second.store.getState().items.map((i) => i.id)).toEqual(["d", "a"])
  })

  test("a change the server will never accept is dropped", async () => {
    const failing = new ListStore<Thing>({
      fetchItems: async () => [],
      send: async () => {
        throw Object.assign(new Error("gone"), { status: 404 })
      },
    })
    await failing.start()
    failing.dispatch(add("a", "Candles"))
    await failing.sync()
    expect(failing.getState().pending).toBe(0)
  })

  test("paused (pretend offline) sends nothing", async () => {
    const { store, server } = setup()
    await store.start()
    store.setPaused(true)
    store.dispatch(add("a", "Candles"))
    await store.sync()
    expect(server.sent).toHaveLength(0)
    expect(store.getState().online).toBe(false)
    store.setPaused(false)
    await store.sync()
    expect(server.sent).toHaveLength(1)
  })

  test("the demo has no server and starts with its own items", async () => {
    const store = new ListStore<Thing>({ initial: [drill], send: async () => {} })
    await store.start()
    expect(store.getState().loaded).toBe(true)
    store.dispatch(add("a", "Candles"))
    expect(store.getState().items).toHaveLength(2)
  })
})
