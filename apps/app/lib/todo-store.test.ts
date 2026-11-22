import { describe, expect, test } from "bun:test"

import type { Task } from "@workspace/schemas"

import { applyTodoOp, type TodoOp } from "./todo-ops"
import { TodoStore } from "./todo-store"

const plumber: Task = {
  id: "p",
  title: "Call the plumber",
  note: "",
  dueDate: "2026-11-25",
  householdId: null,
  assigneeId: null,
  doneAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

class NetworkError extends Error {
  status = 0
}

function setup(initialDevice?: string) {
  const server = {
    tasks: [plumber] as Task[],
    reachable: true,
    sent: [] as TodoOp[],
  }
  let device: string | null = initialDevice ?? null
  const store = new TodoStore({
    fetchTasks: async () => {
      if (!server.reachable) throw new NetworkError()
      return structuredClone(server.tasks)
    },
    send: async (op) => {
      if (!server.reachable) throw new NetworkError()
      server.sent.push(op)
      if (op.type === "update") server.tasks = applyTodoOpTo(server.tasks, op)
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

const applyTodoOpTo = (tasks: Task[], op: TodoOp) => applyTodoOp(tasks, op)

const tick = (done: boolean): TodoOp => ({
  type: "update",
  taskId: "p",
  change: { done },
})

describe("applyTodoOp", () => {
  test("add makes a personal or household task, and adding the same id twice does nothing", () => {
    const add: TodoOp = {
      type: "add",
      id: "n",
      title: "Buy a gift",
      note: "",
      dueDate: null,
      householdId: "home",
      assigneeId: "sam",
    }
    const once = applyTodoOp([plumber], add, "2026-02-01T00:00:00.000Z")
    expect(once).toHaveLength(2)
    expect(once[1]).toMatchObject({
      id: "n",
      householdId: "home",
      assigneeId: "sam",
      doneAt: null,
    })
    expect(applyTodoOp(once, add)).toBe(once)
  })

  test("a personal task never gets an assignee", () => {
    const [task] = applyTodoOp([], {
      type: "add",
      id: "n",
      title: "x",
      note: "",
      dueDate: null,
      householdId: null,
      assigneeId: "sam",
    })
    expect(task?.assigneeId).toBeNull()
    const changed = applyTodoOp([task!], {
      type: "update",
      taskId: "n",
      change: { assigneeId: "sam" },
    })
    expect(changed[0]?.assigneeId).toBeNull()
  })

  test("ticking sets the time once, and opening clears it", () => {
    const done = applyTodoOp([plumber], tick(true), "2026-11-20T10:00:00.000Z")
    expect(done[0]?.doneAt).toBe("2026-11-20T10:00:00.000Z")
    const again = applyTodoOp(done, tick(true), "2026-11-21T10:00:00.000Z")
    expect(again[0]?.doneAt).toBe("2026-11-20T10:00:00.000Z")
    expect(applyTodoOp(done, tick(false))[0]?.doneAt).toBeNull()
  })

  test("update only changes the fields that are given, and can clear the day", () => {
    const changed = applyTodoOp([plumber], {
      type: "update",
      taskId: "p",
      change: { dueDate: null },
    })
    expect(changed[0]).toMatchObject({ title: "Call the plumber", dueDate: null })
  })

  test("remove deletes the task and never changes its input", () => {
    const list = [plumber]
    expect(applyTodoOp(list, { type: "remove", taskId: "p" })).toEqual([])
    expect(list).toHaveLength(1)
  })
})

describe("TodoStore", () => {
  test("loads the tasks from the server and keeps them on the device", async () => {
    const { store, device } = setup()
    await store.start()
    expect(store.getState().tasks).toEqual([plumber])
    expect(store.getState().loaded).toBe(true)
    expect(device()).toContain("Call the plumber")
  })

  test("a change shows at once and is sent when online", async () => {
    const { store, server } = setup()
    await store.start()
    store.dispatch(tick(true))
    expect(store.getState().tasks[0]?.doneAt).not.toBeNull()
    await store.sync()
    expect(server.sent).toHaveLength(1)
    expect(store.getState().pending).toBe(0)
  })

  test("offline changes wait, survive a restart and are sent later", async () => {
    const first = setup()
    await first.store.start()
    first.server.reachable = false
    first.store.dispatch(tick(true))
    await first.store.sync()
    expect(first.store.getState()).toMatchObject({ pending: 1, online: false })
    expect(first.store.getState().tasks[0]?.doneAt).not.toBeNull()

    // The app is closed and opened again, still without a connection.
    const second = setup(first.device() ?? undefined)
    second.server.reachable = false
    await second.store.start()
    expect(second.store.getState().pending).toBe(1)
    expect(second.store.getState().tasks[0]?.doneAt).not.toBeNull()

    second.server.reachable = true
    await second.store.sync()
    expect(second.server.sent).toHaveLength(1)
    expect(second.store.getState()).toMatchObject({ pending: 0, online: true })
  })

  test("a paused store does not talk to the server", async () => {
    const { store, server } = setup()
    await store.start()
    store.setPaused(true)
    store.dispatch(tick(true))
    await store.sync()
    expect(server.sent).toHaveLength(0)
    expect(store.getState()).toMatchObject({ pending: 1, online: false })
    store.setPaused(false)
    await store.sync()
    expect(server.sent).toHaveLength(1)
  })

  test("a change the server refuses is forgotten", async () => {
    const store = new TodoStore({
      fetchTasks: async () => [plumber],
      send: async () => {
        throw Object.assign(new Error("gone"), { status: 404 })
      },
    })
    await store.start()
    store.dispatch(tick(true))
    await store.sync()
    expect(store.getState().pending).toBe(0)
    expect(store.getState().tasks[0]?.doneAt).toBeNull()
  })
})
