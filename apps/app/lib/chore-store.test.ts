import { describe, expect, test } from "bun:test"

import type { Chore } from "@workspace/schemas"

import type { ChoreOp } from "./chore-ops"
import { ChoreStore } from "./chore-store"

const towels: Chore = {
  id: "t",
  name: "Switch towels",
  intervalDays: 3,
  lastDoneOn: null,
  householdId: null,
  kind: "chore" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
}

class NetworkError extends Error {
  status = 0
}

function setup(initialDevice?: string) {
  const server = {
    chores: [towels] as Chore[],
    reachable: true,
    sent: [] as ChoreOp[],
  }
  let device: string | null = initialDevice ?? null
  const store = new ChoreStore({
    fetchChores: async () => {
      if (!server.reachable) throw new NetworkError()
      return structuredClone(server.chores)
    },
    send: async (op) => {
      if (!server.reachable) throw new NetworkError()
      server.sent.push(op)
      if (op.type === "update") {
        Object.assign(server.chores[0]!, op.change)
      }
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

const check = (day: string): ChoreOp => ({
  type: "update",
  choreId: "t",
  change: { lastDoneOn: day },
})

describe("ChoreStore", () => {
  test("loads the chores from the server", async () => {
    const { store } = setup()
    expect(store.getState().loaded).toBe(false)
    await store.start()
    expect(store.getState().chores).toEqual([towels])
    expect(store.getState().loaded).toBe(true)
  })

  test("a check shows at once and is sent to the server", async () => {
    const { store, server } = setup()
    await store.start()
    store.dispatch(check("2026-11-21"))
    expect(store.getState().chores[0]?.lastDoneOn).toBe("2026-11-21")
    await store.sync()
    expect(server.sent).toHaveLength(1)
    expect(store.getState().pending).toBe(0)
  })

  test("works offline: the check stays and is sent when the connection is back", async () => {
    const { store, server } = setup()
    await store.start()
    server.reachable = false
    store.dispatch(check("2026-11-21"))
    await store.sync()
    expect(store.getState().online).toBe(false)
    expect(store.getState().pending).toBe(1)
    expect(store.getState().chores[0]?.lastDoneOn).toBe("2026-11-21")

    server.reachable = true
    await store.sync()
    expect(store.getState().online).toBe(true)
    expect(store.getState().pending).toBe(0)
    expect(server.chores[0]?.lastDoneOn).toBe("2026-11-21")
  })

  test("waiting changes survive closing the app", async () => {
    const first = setup()
    await first.store.start()
    first.server.reachable = false
    first.store.dispatch(check("2026-11-21"))
    await first.store.sync()

    const second = setup(first.device()!)
    second.server.reachable = false
    await second.store.start()
    expect(second.store.getState().loaded).toBe(true)
    expect(second.store.getState().pending).toBe(1)
    expect(second.store.getState().chores[0]?.lastDoneOn).toBe("2026-11-21")
  })

  test("chores saved on the device before kinds existed are chores", async () => {
    const { kind: _kind, ...old } = towels
    const saved = JSON.stringify({ chores: [old], queue: [] })
    const { store, server } = setup(saved)
    server.reachable = false
    await store.start()
    expect(store.getState().chores[0]?.kind).toBe("chore")
  })

  test("a change the server will never accept is dropped", async () => {
    const { store, server } = setup()
    await store.start()
    server.chores = []
    const failing = new ChoreStore({
      fetchChores: async () => [],
      send: async () => {
        throw Object.assign(new Error("gone"), { status: 404 })
      },
    })
    await failing.start()
    failing.dispatch(check("2026-11-21"))
    await failing.sync()
    expect(failing.getState().pending).toBe(0)
  })

  test("paused (pretend offline) sends nothing", async () => {
    const { store, server } = setup()
    await store.start()
    store.setPaused(true)
    store.dispatch(check("2026-11-21"))
    await store.sync()
    expect(server.sent).toHaveLength(0)
    expect(store.getState().online).toBe(false)
    store.setPaused(false)
    await store.sync()
    expect(server.sent).toHaveLength(1)
  })
})
