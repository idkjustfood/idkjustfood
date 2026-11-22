import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type { Contact } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function add(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/contacts", cookie, { name: "Mr Plumber", ...extra })
  expect(res.status).toBe(201)
  return (await body<{ contact: Contact }>(res)).contact
}

async function list(query = "", cookie = olivia) {
  const res = await api.get(`/api/contacts${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ contacts: Contact[] }>(res)).contacts
}

const patch = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/contacts/${id}`, cookie, change)

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

describe("contacts", () => {
  test("needs a signed-in user", async () => {
    expect((await api.get("/api/contacts", "")).status).toBe(401)
  })

  test("adds a contact with empty text where nothing was written", async () => {
    const created = await add()
    expect(created).toMatchObject({ name: "Mr Plumber", householdId: null, role: "", phone: "", email: "", note: "" })
    expect(await list()).toHaveLength(1)
  })

  test("refuses an empty name", async () => {
    const res = await api.post("/api/contacts", olivia, { name: "  " })
    expect(res.status).toBe(400)
  })

  test("keeps role, phone and email", async () => {
    const created = await add({ role: "Plumber", phone: "0123 456", email: "p@example.com" })
    expect(created).toMatchObject({ role: "Plumber", phone: "0123 456", email: "p@example.com" })
  })

  test("refuses something that is not an email address", async () => {
    const res = await api.post("/api/contacts", olivia, { name: "X", email: "nope" })
    expect(res.status).toBe(400)
  })

  test("changes and deletes", async () => {
    const created = await add()
    const res = await patch(created.id, { name: "Renamed", phone: "0123" })
    expect(res.status).toBe(200)
    expect((await body<{ contact: Contact }>(res)).contact.name).toBe("Renamed")
    expect((await api.request("DELETE", `/api/contacts/${created.id}`, olivia)).status).toBe(204)
    expect(await list()).toHaveLength(0)
    expect((await patch(created.id, { name: "Again" })).status).toBe(404)
  })

  test("sending the same id twice adds one", async () => {
    await add({ id: "same" })
    await add({ id: "same" })
    expect(await list()).toHaveLength(1)
  })

  test("a household shares it, personal ones stay private", async () => {
    const { id, member } = await household(olivia)
    await add({ name: "Mine" })
    const shared = await add({ name: "Ours", householdId: id })
    expect((await list("", member)).map((x) => x.name)).toEqual(["Ours"])
    expect((await list(`?householdId=${id}`, member))).toHaveLength(1)
    // Any member can change a shared one.
    expect((await patch(shared.id, { name: "Ours now" }, member)).status).toBe(200)
  })

  test("someone else cannot see, change or delete it, and gets 404", async () => {
    const mine = await add()
    const eve = await api.signUp("Eve")
    expect(await list("", eve)).toHaveLength(0)
    expect((await patch(mine.id, { name: "Hacked" }, eve)).status).toBe(404)
    expect((await api.request("DELETE", `/api/contacts/${mine.id}`, eve)).status).toBe(404)
    const res = await api.post("/api/contacts", eve, { id: mine.id, name: "Steal" })
    expect(res.status).toBe(409)
  })

  test("cannot add to a household you are not in", async () => {
    const { id } = await household(olivia)
    const eve = await api.signUp("Eve")
    const res = await api.post("/api/contacts", eve, { name: "X", householdId: id })
    expect(res.status).toBe(404)
    expect((await api.get(`/api/contacts?householdId=${id}`, eve)).status).toBe(404)
  })
})
