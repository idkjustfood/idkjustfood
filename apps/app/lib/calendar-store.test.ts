import { describe, expect, test } from "bun:test"

import type { CalendarEntry } from "@workspace/schemas"

import { applyCalendarOp, type CalendarOp } from "./calendar-ops"
import { CalendarStore } from "./calendar-store"

const dentist: CalendarEntry = {
  id: "d",
  title: "Dentist",
  color: "sky",
  date: "2026-11-21",
  householdId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

class NetworkError extends Error {
  status = 0
}

function setup(initialDevice?: string) {
  const server = {
    entries: [dentist] as CalendarEntry[],
    reachable: true,
    sent: [] as CalendarOp[],
  }
  let device: string | null = initialDevice ?? null
  const store = new CalendarStore({
    fetchEntries: async () => {
      if (!server.reachable) throw new NetworkError()
      return structuredClone(server.entries)
    },
    send: async (op) => {
      if (!server.reachable) throw new NetworkError()
      server.sent.push(op)
      if (op.type === "update") Object.assign(server.entries[0]!, op.change)
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

const recolor = (color: CalendarEntry["color"]): CalendarOp => ({
  type: "update",
  entryId: "d",
  change: { color },
})

describe("applyCalendarOp", () => {
  test("add makes a personal or household entry, and adding the same id twice does nothing", () => {
    const add: CalendarOp = {
      type: "add",
      id: "n",
      title: "Party",
      color: "rose",
      date: "2026-12-01",
      householdId: "home",
    }
    const once = applyCalendarOp([], add)
    expect(once).toHaveLength(1)
    expect(once[0]).toMatchObject({ title: "Party", householdId: "home" })
    expect(applyCalendarOp(once, add)).toHaveLength(1)
  })

  test("update changes only the given fields, and never changes its input", () => {
    const before = [dentist]
    const after = applyCalendarOp(before, {
      type: "update",
      entryId: "d",
      change: { date: "2026-11-22" },
    })
    expect(after[0]).toMatchObject({ date: "2026-11-22", title: "Dentist", color: "sky" })
    expect(before[0]?.date).toBe("2026-11-21")
  })

  test("remove drops the entry", () => {
    expect(applyCalendarOp([dentist], { type: "remove", entryId: "d" })).toEqual([])
  })
})

describe("CalendarStore", () => {
  test("loads the entries from the server", async () => {
    const { store } = setup()
    expect(store.getState().loaded).toBe(false)
    await store.start()
    expect(store.getState().entries).toEqual([dentist])
    expect(store.getState().loaded).toBe(true)
  })

  test("a change shows at once and is sent to the server", async () => {
    const { store, server } = setup()
    await store.start()
    store.dispatch(recolor("rose"))
    expect(store.getState().entries[0]?.color).toBe("rose")
    await store.sync()
    expect(server.sent).toHaveLength(1)
    expect(store.getState().pending).toBe(0)
  })

  test("works offline: the change stays and is sent when the connection is back", async () => {
    const { store, server } = setup()
    await store.start()
    server.reachable = false
    store.dispatch(recolor("rose"))
    await store.sync()
    expect(store.getState().online).toBe(false)
    expect(store.getState().pending).toBe(1)
    expect(store.getState().entries[0]?.color).toBe("rose")

    server.reachable = true
    await store.sync()
    expect(store.getState().online).toBe(true)
    expect(store.getState().pending).toBe(0)
    expect(server.entries[0]?.color).toBe("rose")
  })

  test("waiting changes survive closing the app", async () => {
    const first = setup()
    await first.store.start()
    first.server.reachable = false
    first.store.dispatch(recolor("rose"))
    await first.store.sync()

    const second = setup(first.device()!)
    second.server.reachable = false
    await second.store.start()
    expect(second.store.getState().loaded).toBe(true)
    expect(second.store.getState().pending).toBe(1)
    expect(second.store.getState().entries[0]?.color).toBe("rose")
  })

  test("a change the server will never accept is dropped", async () => {
    const failing = new CalendarStore({
      fetchEntries: async () => [],
      send: async () => {
        throw Object.assign(new Error("gone"), { status: 404 })
      },
    })
    await failing.start()
    failing.dispatch(recolor("rose"))
    await failing.sync()
    expect(failing.getState().pending).toBe(0)
  })

  test("paused (pretend offline) sends nothing", async () => {
    const { store, server } = setup()
    await store.start()
    store.setPaused(true)
    store.dispatch(recolor("rose"))
    await store.sync()
    expect(server.sent).toHaveLength(0)
    expect(store.getState().online).toBe(false)
    store.setPaused(false)
    await store.sync()
    expect(server.sent).toHaveLength(1)
  })
})
