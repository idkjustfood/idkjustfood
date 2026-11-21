import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import { isChoreDue, type Chore } from "@workspace/schemas"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function addChore(extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/chores", cookie, {
    name: "Switch towels",
    intervalDays: 3,
    ...extra,
  })
  expect(res.status).toBe(201)
  return (await body<{ chore: Chore }>(res)).chore
}

async function listChores(query = "", cookie = olivia) {
  const res = await api.get(`/api/chores${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ chores: Chore[] }>(res)).chores
}

const patch = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/chores/${id}`, cookie, change)

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

describe("chores", () => {
  test("need a signed-in user", async () => {
    expect((await api.get("/api/chores")).status).toBe(401)
    expect((await api.post("/api/chores", undefined, {})).status).toBe(401)
  })

  test("a new chore has an interval in days and is due right away", async () => {
    const chore = await addChore()
    expect(chore.name).toBe("Switch towels")
    expect(chore.intervalDays).toBe(3)
    expect(chore.lastDoneOn).toBeNull()
    expect(chore.householdId).toBeNull()
    expect(isChoreDue(chore, "2026-11-21")).toBe(true)
    expect(await listChores()).toHaveLength(1)
  })

  test("the interval is a whole number of days", async () => {
    for (const intervalDays of [0, -1, 1.5, 366]) {
      const res = await api.post("/api/chores", olivia, {
        name: "Towels",
        intervalDays,
      })
      expect(res.status).toBe(400)
    }
    const noName = await api.post("/api/chores", olivia, {
      name: "  ",
      intervalDays: 3,
    })
    expect(noName.status).toBe(400)
  })

  test("checking a chore stores the day, and it is due again after the interval", async () => {
    const chore = await addChore()
    const res = await patch(chore.id, { lastDoneOn: "2026-11-21" })
    expect(res.status).toBe(200)
    const done = (await body<{ chore: Chore }>(res)).chore
    expect(done.lastDoneOn).toBe("2026-11-21")
    expect(isChoreDue(done, "2026-11-23")).toBe(false)
    expect(isChoreDue(done, "2026-11-24")).toBe(true)
  })

  test("a check can be undone", async () => {
    const chore = await addChore()
    await patch(chore.id, { lastDoneOn: "2026-11-21" })
    const res = await patch(chore.id, { lastDoneOn: null })
    expect((await body<{ chore: Chore }>(res)).chore.lastDoneOn).toBeNull()
  })

  test("only a real calendar day is accepted", async () => {
    const chore = await addChore()
    for (const lastDoneOn of ["2026-02-30", "yesterday", "2026-11-21T14:00:00Z"]) {
      expect((await patch(chore.id, { lastDoneOn })).status).toBe(400)
    }
  })

  test("a chore can be renamed and its interval changed", async () => {
    const chore = await addChore()
    await patch(chore.id, { lastDoneOn: "2026-11-21" })
    const res = await patch(chore.id, { name: "Change sheets", intervalDays: 14 })
    const changed = (await body<{ chore: Chore }>(res)).chore
    expect(changed.name).toBe("Change sheets")
    expect(changed.intervalDays).toBe(14)
    expect(changed.lastDoneOn).toBe("2026-11-21")
  })

  test("a chore can be deleted", async () => {
    const chore = await addChore()
    expect((await api.del(`/api/chores/${chore.id}`, olivia)).status).toBe(204)
    expect(await listChores()).toHaveLength(0)
    expect((await api.del(`/api/chores/${chore.id}`, olivia)).status).toBe(404)
  })

  test("sending the same id twice adds the chore once", async () => {
    const first = await addChore({ id: "device-1" })
    await patch(first.id, { lastDoneOn: "2026-11-21" })
    const again = await addChore({ id: "device-1" })
    expect(again.lastDoneOn).toBe("2026-11-21")
    expect(await listChores()).toHaveLength(1)
  })

  test("an id used by someone else's chore gives 409", async () => {
    await addChore({ id: "taken" })
    const eve = await api.signUp("Eve")
    const res = await api.post("/api/chores", eve, {
      id: "taken",
      name: "Mine",
      intervalDays: 2,
    })
    expect(res.status).toBe(409)
  })
})

describe("who can see a chore", () => {
  test("a personal chore is private, and looks like it does not exist to others", async () => {
    const chore = await addChore()
    const eve = await api.signUp("Eve")
    expect(await listChores("", eve)).toHaveLength(0)
    expect((await patch(chore.id, { lastDoneOn: "2026-11-21" }, eve)).status).toBe(404)
    expect((await api.del(`/api/chores/${chore.id}`, eve)).status).toBe(404)
    expect((await listChores())[0]?.lastDoneOn).toBeNull()
  })

  test("a household chore is shared: one person's check counts for everyone", async () => {
    const home = await household(olivia)
    const chore = await addChore({ householdId: home.id })
    expect(chore.householdId).toBe(home.id)

    const seen = await listChores(`?householdId=${home.id}`, home.member)
    expect(seen.map((c) => c.id)).toEqual([chore.id])

    const res = await patch(chore.id, { lastDoneOn: "2026-11-21" }, home.member)
    expect(res.status).toBe(200)
    const [forOlivia] = await listChores(`?householdId=${home.id}`)
    expect(forOlivia?.lastDoneOn).toBe("2026-11-21")
  })

  test("a household's chores are not in the personal list of a space", async () => {
    const home = await household(olivia)
    await addChore({ householdId: home.id })
    await addChore({ name: "Mine" })
    expect(await listChores(`?householdId=${home.id}`)).toHaveLength(1)
    expect(await listChores()).toHaveLength(2)
  })

  test("someone outside the household cannot see, add or change its chores", async () => {
    const home = await household(olivia)
    const chore = await addChore({ householdId: home.id })
    const eve = await api.signUp("Eve")
    expect((await api.get(`/api/chores?householdId=${home.id}`, eve)).status).toBe(404)
    expect(
      (
        await api.post("/api/chores", eve, {
          name: "Sneaky",
          intervalDays: 1,
          householdId: home.id,
        })
      ).status
    ).toBe(404)
    expect((await patch(chore.id, { name: "Hacked" }, eve)).status).toBe(404)
    expect((await api.del(`/api/chores/${chore.id}`, eve)).status).toBe(404)
  })

  test("a person who leaves the household loses its chores", async () => {
    const home = await household(olivia)
    await addChore({ householdId: home.id })
    const res = await api.get(`/api/chores`, home.member)
    expect((await body<{ chores: Chore[] }>(res)).chores).toHaveLength(1)
    const leave = await api.post(`/api/households/${home.id}/leave`, home.member)
    expect(leave.status).toBe(204)
    expect(await listChores("", home.member)).toHaveLength(0)
  })
})
