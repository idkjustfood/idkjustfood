import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type { Task } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function addTask(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/tasks", cookie, {
    title: "Call the plumber",
    ...extra,
  })
  expect(res.status).toBe(201)
  return (await body<{ task: Task }>(res)).task
}

async function listTasks(query = "", cookie = olivia) {
  const res = await api.get(`/api/tasks${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ tasks: Task[] }>(res)).tasks
}

const patch = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/tasks/${id}`, cookie, change)

async function userId(cookie: string) {
  const res = await api.get("/api/me", cookie)
  return (await body<{ user: { id: string } }>(res)).user.id
}

async function household(owner: string) {
  const res = await api.post("/api/households", owner, { name: "Home" })
  expect(res.status).toBe(201)
  const id = (await body<{ household: { id: string } }>(res)).household.id
  const member = await api.signUp("Sam")
  const invite = await api.post(`/api/households/${id}/invites`, owner)
  const { invite: link } = await body<{ invite: { id: string } }>(invite)
  await api.post(`/api/invites/${link.id}/accept`, member)
  return { id, member }
}

beforeEach(async () => {
  api = client(createApp(await createTestDb(), testEnv))
  olivia = await api.signUp("Olivia")
})

describe("tasks", () => {
  test("need a signed-in user", async () => {
    expect((await api.get("/api/tasks")).status).toBe(401)
    expect((await api.post("/api/tasks", undefined, {})).status).toBe(401)
  })

  test("a new task is personal, open, and has no day and no note", async () => {
    const task = await addTask()
    expect(task).toMatchObject({
      title: "Call the plumber",
      note: "",
      dueDate: null,
      householdId: null,
      assigneeId: null,
      doneAt: null,
    })
    expect(await listTasks()).toHaveLength(1)
  })

  test("a title and a real due day are needed", async () => {
    for (const bad of [
      { title: "  " },
      { title: "x", dueDate: "2026-02-30" },
      { title: "x", dueDate: "tomorrow" },
      {},
    ]) {
      expect((await api.post("/api/tasks", olivia, bad)).status).toBe(400)
    }
  })

  test("a task can have a note and a due day, and can change them", async () => {
    const task = await addTask({ note: "Ask about the boiler", dueDate: "2026-11-25" })
    expect(task.note).toBe("Ask about the boiler")
    const res = await patch(task.id, { title: "Call", dueDate: null, note: "" })
    expect(res.status).toBe(200)
    expect((await body<{ task: Task }>(res)).task).toMatchObject({
      title: "Call",
      dueDate: null,
      note: "",
    })
  })

  test("a task can be ticked off and opened again", async () => {
    const task = await addTask()
    const done = (await body<{ task: Task }>(await patch(task.id, { done: true }))).task
    expect(done.doneAt).not.toBeNull()
    const open = (await body<{ task: Task }>(await patch(task.id, { done: false }))).task
    expect(open.doneAt).toBeNull()
  })

  test("open tasks come first, soonest day first, and done tasks last", async () => {
    await addTask({ title: "No day" })
    await addTask({ title: "Later", dueDate: "2026-12-01" })
    await addTask({ title: "Sooner", dueDate: "2026-11-02" })
    const finished = await addTask({ title: "Finished", dueDate: "2026-10-01" })
    await patch(finished.id, { done: true })
    expect((await listTasks()).map((t) => t.title)).toEqual([
      "Sooner",
      "Later",
      "No day",
      "Finished",
    ])
  })

  test("a task can be deleted", async () => {
    const task = await addTask()
    expect((await api.del(`/api/tasks/${task.id}`, olivia)).status).toBe(204)
    expect(await listTasks()).toHaveLength(0)
    expect((await api.del(`/api/tasks/${task.id}`, olivia)).status).toBe(404)
  })

  test("sending the same id twice adds the task once", async () => {
    const first = await addTask({ id: "device-1" })
    await patch(first.id, { done: true })
    const again = await addTask({ id: "device-1" })
    expect(again.doneAt).not.toBeNull()
    expect(await listTasks()).toHaveLength(1)
  })

  test("an id used by someone else's task gives 409", async () => {
    await addTask({ id: "taken" })
    const eve = await api.signUp("Eve")
    const res = await api.post("/api/tasks", eve, { id: "taken", title: "Mine" })
    expect(res.status).toBe(409)
  })

  test("a personal task cannot be assigned to anyone", async () => {
    const sam = await api.signUp("Sam")
    const res = await api.post("/api/tasks", olivia, {
      title: "x",
      assigneeId: await userId(sam),
    })
    expect(res.status).toBe(400)
  })
})

describe("who can see a task", () => {
  test("a personal task is private, and looks like it does not exist to others", async () => {
    const task = await addTask()
    const eve = await api.signUp("Eve")
    expect(await listTasks("", eve)).toHaveLength(0)
    expect((await patch(task.id, { title: "Hacked" }, eve)).status).toBe(404)
    expect((await api.del(`/api/tasks/${task.id}`, eve)).status).toBe(404)
    expect((await listTasks())[0]?.title).toBe("Call the plumber")
  })

  test("a personal task of a household member stays hidden from the household", async () => {
    const home = await household(olivia)
    await addTask({ title: "Surprise gift" })
    expect(await listTasks("", home.member)).toHaveLength(0)
    expect(await listTasks(`?householdId=${home.id}`, home.member)).toHaveLength(0)
  })

  test("a household task is created for the household and every member sees it", async () => {
    const home = await household(olivia)
    const task = await addTask({ householdId: home.id })
    expect(task.householdId).toBe(home.id)
    expect((await listTasks(`?householdId=${home.id}`, home.member)).map((t) => t.id)).toEqual([
      task.id,
    ])
    expect((await listTasks("", home.member)).map((t) => t.id)).toEqual([task.id])
  })

  test("a household task can be assigned to a member, and only to a member", async () => {
    const home = await household(olivia)
    const samId = await userId(home.member)
    const task = await addTask({ householdId: home.id, assigneeId: samId })
    expect(task.assigneeId).toBe(samId)

    const eveId = await userId(await api.signUp("Eve"))
    expect((await patch(task.id, { assigneeId: eveId })).status).toBe(400)
    expect(
      (
        await api.post("/api/tasks", olivia, {
          title: "x",
          householdId: home.id,
          assigneeId: eveId,
        })
      ).status
    ).toBe(400)
    expect((await patch(task.id, { assigneeId: null })).status).toBe(200)
  })

  test("any member can change, tick off or delete a household task", async () => {
    const home = await household(olivia)
    const task = await addTask({ householdId: home.id })
    expect((await patch(task.id, { done: true }, home.member)).status).toBe(200)
    expect((await listTasks(`?householdId=${home.id}`))[0]?.doneAt).not.toBeNull()
    expect((await api.del(`/api/tasks/${task.id}`, home.member)).status).toBe(204)
    expect(await listTasks(`?householdId=${home.id}`)).toHaveLength(0)
  })

  test("a household's tasks are kept apart from personal ones", async () => {
    const home = await household(olivia)
    await addTask({ householdId: home.id })
    await addTask({ title: "Mine" })
    expect(await listTasks(`?householdId=${home.id}`)).toHaveLength(1)
    expect(await listTasks()).toHaveLength(2)
  })

  test("someone outside the household cannot see, add or change its tasks", async () => {
    const home = await household(olivia)
    const task = await addTask({ householdId: home.id })
    const eve = await api.signUp("Eve")
    expect((await api.get(`/api/tasks?householdId=${home.id}`, eve)).status).toBe(404)
    expect(
      (await api.post("/api/tasks", eve, { title: "Sneaky", householdId: home.id })).status
    ).toBe(404)
    expect((await patch(task.id, { title: "Hacked" }, eve)).status).toBe(404)
    expect((await api.del(`/api/tasks/${task.id}`, eve)).status).toBe(404)
  })

  test("a person who leaves the household loses its tasks", async () => {
    const home = await household(olivia)
    await addTask({ householdId: home.id })
    expect(await listTasks("", home.member)).toHaveLength(1)
    const leave = await api.post(`/api/households/${home.id}/leave`, home.member)
    expect(leave.status).toBe(204)
    expect(await listTasks("", home.member)).toHaveLength(0)
  })
})
