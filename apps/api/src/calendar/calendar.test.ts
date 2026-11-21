import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import type { CalendarEntry } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function addEntry(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/calendar", cookie, {
    title: "Dentist",
    color: "sky",
    date: "2026-11-21",
    ...extra,
  })
  expect(res.status).toBe(201)
  return (await body<{ entry: CalendarEntry }>(res)).entry
}

async function listEntries(query = "", cookie = olivia) {
  const res = await api.get(`/api/calendar${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ entries: CalendarEntry[] }>(res)).entries
}

const patch = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/calendar/${id}`, cookie, change)

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

describe("calendar entries", () => {
  test("need a signed-in user", async () => {
    expect((await api.get("/api/calendar")).status).toBe(401)
    expect((await api.post("/api/calendar", undefined, {})).status).toBe(401)
  })

  test("a new entry has a title, a colour and a day, and is personal", async () => {
    const entry = await addEntry()
    expect(entry.title).toBe("Dentist")
    expect(entry.color).toBe("sky")
    expect(entry.date).toBe("2026-11-21")
    expect(entry.householdId).toBeNull()
    expect(await listEntries()).toHaveLength(1)
  })

  test("a title, a known colour and a real day are needed", async () => {
    const valid = { title: "Dentist", color: "sky", date: "2026-11-21" }
    for (const bad of [
      { ...valid, title: "  " },
      { ...valid, color: "neon" },
      { ...valid, date: "2026-02-30" },
      { ...valid, date: "tomorrow" },
      { title: "Dentist", date: "2026-11-21" },
    ]) {
      expect((await api.post("/api/calendar", olivia, bad)).status).toBe(400)
    }
  })

  test("entries come back sorted by day", async () => {
    await addEntry({ title: "Later", date: "2026-12-01" })
    await addEntry({ title: "Sooner", date: "2026-11-02" })
    expect((await listEntries()).map((e) => e.title)).toEqual(["Sooner", "Later"])
  })

  test("an entry can change its title, colour and day", async () => {
    const entry = await addEntry()
    const res = await patch(entry.id, {
      title: "Dentist, 10:00",
      color: "rose",
      date: "2026-11-22",
    })
    expect(res.status).toBe(200)
    const changed = (await body<{ entry: CalendarEntry }>(res)).entry
    expect(changed).toMatchObject({
      title: "Dentist, 10:00",
      color: "rose",
      date: "2026-11-22",
    })
  })

  test("a change with a bad value is refused", async () => {
    const entry = await addEntry()
    for (const change of [{ color: "neon" }, { date: "nope" }, { title: "" }]) {
      expect((await patch(entry.id, change)).status).toBe(400)
    }
  })

  test("an entry can be deleted", async () => {
    const entry = await addEntry()
    expect((await api.del(`/api/calendar/${entry.id}`, olivia)).status).toBe(204)
    expect(await listEntries()).toHaveLength(0)
    expect((await api.del(`/api/calendar/${entry.id}`, olivia)).status).toBe(404)
  })

  test("sending the same id twice adds the entry once", async () => {
    const first = await addEntry({ id: "device-1" })
    await patch(first.id, { color: "rose" })
    const again = await addEntry({ id: "device-1" })
    expect(again.color).toBe("rose")
    expect(await listEntries()).toHaveLength(1)
  })

  test("an id used by someone else's entry gives 409", async () => {
    await addEntry({ id: "taken" })
    const eve = await api.signUp("Eve")
    const res = await api.post("/api/calendar", eve, {
      id: "taken",
      title: "Mine",
      color: "sage",
      date: "2026-11-21",
    })
    expect(res.status).toBe(409)
  })
})

describe("who can see a calendar entry", () => {
  test("a personal entry is private, and looks like it does not exist to others", async () => {
    const entry = await addEntry()
    const eve = await api.signUp("Eve")
    expect(await listEntries("", eve)).toHaveLength(0)
    expect((await patch(entry.id, { title: "Hacked" }, eve)).status).toBe(404)
    expect((await api.del(`/api/calendar/${entry.id}`, eve)).status).toBe(404)
    expect((await listEntries())[0]?.title).toBe("Dentist")
  })

  test("a personal entry of a household member stays hidden from the household", async () => {
    const home = await household(olivia)
    await addEntry({ title: "Surprise gift" })
    expect(await listEntries("", home.member)).toHaveLength(0)
    expect(await listEntries(`?householdId=${home.id}`, home.member)).toHaveLength(0)
  })

  test("a household entry is created for the household and every member sees it", async () => {
    const home = await household(olivia)
    const entry = await addEntry({ householdId: home.id })
    expect(entry.householdId).toBe(home.id)

    const seen = await listEntries(`?householdId=${home.id}`, home.member)
    expect(seen.map((e) => e.id)).toEqual([entry.id])
    expect((await listEntries("", home.member)).map((e) => e.id)).toEqual([entry.id])
  })

  test("any member can change or delete a household entry", async () => {
    const home = await household(olivia)
    const entry = await addEntry({ householdId: home.id })
    const res = await patch(entry.id, { color: "sage" }, home.member)
    expect(res.status).toBe(200)
    expect((await listEntries(`?householdId=${home.id}`))[0]?.color).toBe("sage")
    expect((await api.del(`/api/calendar/${entry.id}`, home.member)).status).toBe(204)
    expect(await listEntries(`?householdId=${home.id}`)).toHaveLength(0)
  })

  test("a household's entries are kept apart from personal ones", async () => {
    const home = await household(olivia)
    await addEntry({ householdId: home.id })
    await addEntry({ title: "Mine" })
    expect(await listEntries(`?householdId=${home.id}`)).toHaveLength(1)
    expect(await listEntries()).toHaveLength(2)
  })

  test("someone outside the household cannot see, add or change its entries", async () => {
    const home = await household(olivia)
    const entry = await addEntry({ householdId: home.id })
    const eve = await api.signUp("Eve")
    expect((await api.get(`/api/calendar?householdId=${home.id}`, eve)).status).toBe(404)
    expect(
      (
        await api.post("/api/calendar", eve, {
          title: "Sneaky",
          color: "rose",
          date: "2026-11-21",
          householdId: home.id,
        })
      ).status
    ).toBe(404)
    expect((await patch(entry.id, { title: "Hacked" }, eve)).status).toBe(404)
    expect((await api.del(`/api/calendar/${entry.id}`, eve)).status).toBe(404)
  })

  test("a person who leaves the household loses its entries", async () => {
    const home = await household(olivia)
    await addEntry({ householdId: home.id })
    expect(await listEntries("", home.member)).toHaveLength(1)
    const leave = await api.post(`/api/households/${home.id}/leave`, home.member)
    expect(leave.status).toBe(204)
    expect(await listEntries("", home.member)).toHaveLength(0)
  })
})
