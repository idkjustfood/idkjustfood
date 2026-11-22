import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type { Wish, WishPerson } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function addPerson(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/wish-people", cookie, { name: "Mia", ...extra })
  expect(res.status).toBe(201)
  return (await body<{ person: WishPerson }>(res)).person
}

async function addWish(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/wishes", cookie, { title: "Lego set", ...extra })
  expect(res.status).toBe(201)
  return (await body<{ wish: Wish }>(res)).wish
}

async function wishes(query = "", cookie = olivia) {
  const res = await api.get(`/api/wishes${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ wishes: Wish[] }>(res)).wishes
}

async function people(query = "", cookie = olivia) {
  const res = await api.get(`/api/wish-people${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ people: WishPerson[] }>(res)).people
}

const patchWish = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/wishes/${id}`, cookie, change)

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

describe("wishlist people", () => {
  test("needs a signed-in user", async () => {
    expect((await api.get("/api/wish-people", "")).status).toBe(401)
    expect((await api.get("/api/wishes", "")).status).toBe(401)
  })

  test("adds, renames and deletes a person", async () => {
    const mia = await addPerson()
    expect(mia).toMatchObject({ name: "Mia", householdId: null })
    const res = await api.request("PATCH", `/api/wish-people/${mia.id}`, olivia, { name: "Mia-Lou" })
    expect((await body<{ person: WishPerson }>(res)).person.name).toBe("Mia-Lou")
    expect((await api.request("DELETE", `/api/wish-people/${mia.id}`, olivia)).status).toBe(204)
    expect(await people()).toHaveLength(0)
  })

  test("refuses an empty name", async () => {
    expect((await api.post("/api/wish-people", olivia, { name: " " })).status).toBe(400)
  })

  test("deleting a person deletes their wishes but not the root wishes", async () => {
    const mia = await addPerson()
    await addWish({ title: "For Mia", personId: mia.id })
    await addWish({ title: "For nobody" })
    await api.request("DELETE", `/api/wish-people/${mia.id}`, olivia)
    expect((await wishes()).map((w) => w.title)).toEqual(["For nobody"])
  })
})

describe("wishes", () => {
  test("a wish can sit at the root or under a person", async () => {
    const mia = await addPerson()
    const root = await addWish({ title: "New bike" })
    const under = await addWish({ title: "Lego", personId: mia.id })
    expect(root).toMatchObject({ personId: null, done: false, note: "", link: "" })
    expect(under.personId).toBe(mia.id)
  })

  test("a wish moves to a person and back to the root", async () => {
    const mia = await addPerson()
    const wish = await addWish()
    const moved = await body<{ wish: Wish }>(await patchWish(wish.id, { personId: mia.id }))
    expect(moved.wish.personId).toBe(mia.id)
    const back = await body<{ wish: Wish }>(await patchWish(wish.id, { personId: null }))
    expect(back.wish.personId).toBeNull()
  })

  test("marks a wish as done and keeps note and link", async () => {
    const wish = await addWish({ note: "Size M", link: "https://example.com/shirt" })
    expect(wish).toMatchObject({ note: "Size M", link: "https://example.com/shirt" })
    const res = await patchWish(wish.id, { done: true })
    expect((await body<{ wish: Wish }>(res)).wish.done).toBe(true)
  })

  test("refuses an empty title and a link that is not a web link", async () => {
    expect((await api.post("/api/wishes", olivia, { title: " " })).status).toBe(400)
    expect((await api.post("/api/wishes", olivia, { title: "X", link: "javascript:alert(1)" })).status).toBe(400)
  })

  test("sending the same id twice adds one", async () => {
    await addWish({ id: "same" })
    await addWish({ id: "same" })
    expect(await wishes()).toHaveLength(1)
  })

  test("a wish cannot go under a person of another space or another user", async () => {
    const { id } = await household(olivia)
    const personal = await addPerson({ name: "Personal" })
    const shared = await addPerson({ name: "Shared", householdId: id })
    const eve = await api.signUp("Eve")
    // Household wish under a personal person, and the other way round.
    expect((await api.post("/api/wishes", olivia, { title: "X", householdId: id, personId: personal.id })).status).toBe(404)
    expect((await api.post("/api/wishes", olivia, { title: "X", personId: shared.id })).status).toBe(404)
    // Someone else's person.
    expect((await api.post("/api/wishes", eve, { title: "X", personId: personal.id })).status).toBe(404)
    const wish = await addWish()
    expect((await patchWish(wish.id, { personId: shared.id })).status).toBe(404)
    expect((await patchWish(wish.id, { personId: personal.id }, eve)).status).toBe(404)
  })

  test("a household shares people and wishes, personal ones stay private", async () => {
    const { id, member } = await household(olivia)
    await addPerson({ name: "Mine" })
    const ours = await addPerson({ name: "Grandpa", householdId: id })
    await addWish({ title: "Mine" })
    const shared = await addWish({ title: "Socks", householdId: id, personId: ours.id })
    expect((await people("", member)).map((p) => p.name)).toEqual(["Grandpa"])
    expect((await wishes("", member)).map((w) => w.title)).toEqual(["Socks"])
    expect(await wishes(`?householdId=${id}`, member)).toHaveLength(1)
    expect((await patchWish(shared.id, { done: true }, member)).status).toBe(200)
  })

  test("someone else cannot see, change or delete them, and gets 404", async () => {
    const mia = await addPerson()
    const wish = await addWish()
    const eve = await api.signUp("Eve")
    expect(await wishes("", eve)).toHaveLength(0)
    expect(await people("", eve)).toHaveLength(0)
    expect((await patchWish(wish.id, { title: "Hacked" }, eve)).status).toBe(404)
    expect((await api.request("DELETE", `/api/wishes/${wish.id}`, eve)).status).toBe(404)
    expect((await api.request("DELETE", `/api/wish-people/${mia.id}`, eve)).status).toBe(404)
    expect((await api.post("/api/wishes", eve, { id: wish.id, title: "Steal" })).status).toBe(409)
  })

  test("cannot add to a household you are not in", async () => {
    const { id } = await household(olivia)
    const eve = await api.signUp("Eve")
    expect((await api.post("/api/wishes", eve, { title: "X", householdId: id })).status).toBe(404)
    expect((await api.post("/api/wish-people", eve, { name: "X", householdId: id })).status).toBe(404)
    expect((await api.get(`/api/wishes?householdId=${id}`, eve)).status).toBe(404)
  })
})
