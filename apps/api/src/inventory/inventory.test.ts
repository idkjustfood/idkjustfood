import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type { InventoryItem } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function add(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/inventory", cookie, { name: "Candles", ...extra })
  expect(res.status).toBe(201)
  return (await body<{ item: InventoryItem }>(res)).item
}

async function list(query = "", cookie = olivia) {
  const res = await api.get(`/api/inventory${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ items: InventoryItem[] }>(res)).items
}

const patch = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/inventory/${id}`, cookie, change)

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

describe("inventory", () => {
  test("needs a signed-in user", async () => {
    expect((await api.get("/api/inventory", "")).status).toBe(401)
  })

  test("adds an item with empty text where nothing was written", async () => {
    const created = await add()
    expect(created).toMatchObject({ name: "Candles", householdId: null, place: "", quantity: 1, note: "" })
    expect(await list()).toHaveLength(1)
  })

  test("refuses an empty name", async () => {
    const res = await api.post("/api/inventory", olivia, { name: "  " })
    expect(res.status).toBe(400)
  })

  test("keeps where it is and how many", async () => {
    const created = await add({ place: "Kitchen drawer", quantity: 3 })
    expect(created).toMatchObject({ place: "Kitchen drawer", quantity: 3 })
  })

  test("refuses a quantity below 1", async () => {
    const res = await api.post("/api/inventory", olivia, { name: "X", quantity: 0 })
    expect(res.status).toBe(400)
  })

  test("changes and deletes", async () => {
    const created = await add()
    const res = await patch(created.id, { name: "Renamed", quantity: 5 })
    expect(res.status).toBe(200)
    expect((await body<{ item: InventoryItem }>(res)).item.name).toBe("Renamed")
    expect((await api.request("DELETE", `/api/inventory/${created.id}`, olivia)).status).toBe(204)
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
    expect((await api.request("DELETE", `/api/inventory/${mine.id}`, eve)).status).toBe(404)
    const res = await api.post("/api/inventory", eve, { id: mine.id, name: "Steal" })
    expect(res.status).toBe(409)
  })

  test("cannot add to a household you are not in", async () => {
    const { id } = await household(olivia)
    const eve = await api.signUp("Eve")
    const res = await api.post("/api/inventory", eve, { name: "X", householdId: id })
    expect(res.status).toBe(404)
    expect((await api.get(`/api/inventory?householdId=${id}`, eve)).status).toBe(404)
  })
})
