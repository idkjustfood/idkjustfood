import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type { Note } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function add(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/notes", cookie, { title: "Ideas", body: "Paint the hall", ...extra })
  expect(res.status).toBe(201)
  return (await body<{ note: Note }>(res)).note
}

async function list(query = "", cookie = olivia) {
  const res = await api.get(`/api/notes${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ notes: Note[] }>(res)).notes
}

const patch = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/notes/${id}`, cookie, change)

async function household(owner: string) {
  const res = await api.post("/api/households", owner, { name: "Home" })
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

describe("notes", () => {
  test("needs a signed-in user", async () => {
    expect((await api.get("/api/notes", "")).status).toBe(401)
  })

  test("adds a personal note", async () => {
    expect(await add()).toMatchObject({ title: "Ideas", body: "Paint the hall", householdId: null })
    expect(await list()).toHaveLength(1)
  })

  test("a note may have only a title or only text, but not nothing", async () => {
    expect((await api.post("/api/notes", olivia, { title: "Only title" })).status).toBe(201)
    expect((await api.post("/api/notes", olivia, { body: "Only text" })).status).toBe(201)
    expect((await api.post("/api/notes", olivia, { title: " ", body: "  " })).status).toBe(400)
    expect((await api.post("/api/notes", olivia, {})).status).toBe(400)
  })

  test("changes and deletes", async () => {
    const created = await add()
    const res = await patch(created.id, { body: "Paint the kitchen" })
    expect(res.status).toBe(200)
    expect((await body<{ note: Note }>(res)).note).toMatchObject({ title: "Ideas", body: "Paint the kitchen" })
    expect((await api.request("DELETE", `/api/notes/${created.id}`, olivia)).status).toBe(204)
    expect(await list()).toHaveLength(0)
    expect((await patch(created.id, { body: "x" })).status).toBe(404)
  })

  test("sending the same id twice adds one", async () => {
    await add({ id: "same" })
    await add({ id: "same" })
    expect(await list()).toHaveLength(1)
  })

  test("a household shares it, personal ones stay private", async () => {
    const { id, member } = await household(olivia)
    await add({ title: "Mine" })
    const shared = await add({ title: "Ours", householdId: id })
    expect((await list("", member)).map((x) => x.title)).toEqual(["Ours"])
    expect(await list(`?householdId=${id}`, member)).toHaveLength(1)
    expect((await patch(shared.id, { title: "Ours now" }, member)).status).toBe(200)
  })

  test("someone else cannot see, change or delete it, and gets 404", async () => {
    const mine = await add()
    const eve = await api.signUp("Eve")
    expect(await list("", eve)).toHaveLength(0)
    expect((await patch(mine.id, { title: "Hacked" }, eve)).status).toBe(404)
    expect((await api.request("DELETE", `/api/notes/${mine.id}`, eve)).status).toBe(404)
    expect((await api.post("/api/notes", eve, { id: mine.id, title: "Steal" })).status).toBe(409)
  })

  test("cannot add to a household you are not in", async () => {
    const { id } = await household(olivia)
    const eve = await api.signUp("Eve")
    expect((await api.post("/api/notes", eve, { title: "X", householdId: id })).status).toBe(404)
    expect((await api.get(`/api/notes?householdId=${id}`, eve)).status).toBe(404)
  })
})
