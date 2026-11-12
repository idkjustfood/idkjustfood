import { beforeEach, describe, expect, test } from "bun:test"

import { createApp } from "../app.js"
import { client, createTestDb, testEnv } from "../test-helpers.js"

type Household = { id: string; name: string; role: string }
type Member = { id: string; userId: string; name: string; role: string }
type Invite = { id: string; url: string | null; expiresAt: string }

let api: ReturnType<typeof client>
let owner: string
let household: Household

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function createInvite(cookie = owner) {
  const res = await api.post(`/api/households/${household.id}/invites`, cookie)
  expect(res.status).toBe(201)
  return (await body<{ invite: Invite }>(res)).invite
}

async function members(cookie = owner) {
  const res = await api.get(`/api/households/${household.id}/members`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ members: Member[] }>(res)).members
}

/** Signs up a new user and lets them join the household through a link. */
async function join(name: string) {
  const cookie = await api.signUp(name)
  const invite = await createInvite()
  const res = await api.post(`/api/invites/${invite.id}/accept`, cookie)
  expect(res.status).toBe(200)
  return cookie
}

beforeEach(async () => {
  const app = createApp(await createTestDb(), {
    ...testEnv,
    APP_URL: "https://app.example.com/",
  })
  api = client(app)
  owner = await api.signUp("Olivia")
  const res = await api.post("/api/households", owner, { name: "Home" })
  expect(res.status).toBe(201)
  household = (await body<{ household: Household }>(res)).household
})

describe("households", () => {
  test("the creator is the owner and sees the household", async () => {
    expect(household).toMatchObject({ name: "Home", role: "owner" })
    const res = await api.get("/api/households", owner)
    expect(await body(res)).toEqual({ households: [household] })
  })

  test("need a signed-in user", async () => {
    expect((await api.get("/api/households")).status).toBe(401)
    expect(
      (await api.get(`/api/households/${household.id}/members`)).status
    ).toBe(401)
    expect((await api.post("/api/invites/abc/accept")).status).toBe(401)
  })

  test("are hidden from people who are not members", async () => {
    const stranger = await api.signUp("Sam")
    const res = await api.get(
      `/api/households/${household.id}/members`,
      stranger
    )
    expect(res.status).toBe(404)
  })

  test("reject an empty name", async () => {
    const res = await api.post("/api/households", owner, { name: "  " })
    expect(res.status).toBe(400)
  })
})

describe("invite links", () => {
  test("an owner creates a link that someone else can accept", async () => {
    const invite = await createInvite()
    expect(invite.url).toBe(`https://app.example.com/invite/${invite.id}`)
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now())

    const bob = await api.signUp("Bob")
    const preview = await api.get(`/api/invites/${invite.id}`, bob)
    expect(preview.status).toBe(200)
    expect(await body(preview)).toMatchObject({
      invite: {
        householdId: household.id,
        householdName: "Home",
        inviterName: "Olivia",
        alreadyMember: false,
      },
    })

    const accept = await api.post(`/api/invites/${invite.id}/accept`, bob)
    expect(accept.status).toBe(200)
    expect(await body(accept)).toEqual({
      household: { id: household.id, name: "Home", role: "member" },
    })

    const list = await members()
    expect(list.map((m) => [m.name, m.role])).toEqual([
      ["Olivia", "owner"],
      ["Bob", "member"],
    ])
    // Bob now sees the household and its members too.
    expect((await members(bob)).length).toBe(2)
  })

  test("work without APP_URL and without any email setup", async () => {
    const api2 = client(createApp(await createTestDb(), testEnv))
    const o = await api2.signUp("Olivia")
    const h = await body<{ household: Household }>(
      await api2.post("/api/households", o, { name: "Flat" })
    )
    const res = await api2.post(`/api/households/${h.household.id}/invites`, o)
    const { invite } = await body<{ invite: Invite }>(res)
    expect(invite.url).toBeNull()
    const bob = await api2.signUp("Bob")
    const accept = await api2.post(`/api/invites/${invite.id}/accept`, bob)
    expect(accept.status).toBe(200)
  })

  test("work only once", async () => {
    const invite = await createInvite()
    const bob = await api.signUp("Bob")
    const carol = await api.signUp("Carol")
    await api.post(`/api/invites/${invite.id}/accept`, bob)
    const again = await api.post(`/api/invites/${invite.id}/accept`, carol)
    expect(again.status).toBe(404)
  })

  test("can be declined, and then stop working", async () => {
    const invite = await createInvite()
    const bob = await api.signUp("Bob")
    expect(
      (await api.post(`/api/invites/${invite.id}/decline`, bob)).status
    ).toBe(204)
    expect((await api.get(`/api/invites/${invite.id}`, bob)).status).toBe(404)
    expect(
      (await api.post(`/api/invites/${invite.id}/accept`, bob)).status
    ).toBe(404)
    expect((await members()).length).toBe(1)
  })

  test("are listed while pending and stop working once cancelled", async () => {
    const invite = await createInvite()
    const listed = await api.get(
      `/api/households/${household.id}/invites`,
      owner
    )
    expect(
      (await body<{ invites: Invite[] }>(listed)).invites.map((i) => i.id)
    ).toEqual([invite.id])

    const cancel = await api.del(
      `/api/households/${household.id}/invites/${invite.id}`,
      owner
    )
    expect(cancel.status).toBe(204)

    const bob = await api.signUp("Bob")
    expect((await api.get(`/api/invites/${invite.id}`, bob)).status).toBe(404)
    expect(
      (await api.post(`/api/invites/${invite.id}/accept`, bob)).status
    ).toBe(404)
    const after = await api.get(
      `/api/households/${household.id}/invites`,
      owner
    )
    expect(await body(after)).toEqual({ invites: [] })
  })

  test("can't be accepted by someone already in the household", async () => {
    const invite = await createInvite()
    const preview = await api.get(`/api/invites/${invite.id}`, owner)
    expect(await body(preview)).toMatchObject({
      invite: { alreadyMember: true },
    })
    const res = await api.post(`/api/invites/${invite.id}/accept`, owner)
    expect(res.status).toBe(409)
  })

  test("unknown links are rejected", async () => {
    const bob = await api.signUp("Bob")
    expect((await api.get("/api/invites/nope", bob)).status).toBe(404)
  })
})

describe("members", () => {
  test("cannot invite, cancel invites or remove anyone", async () => {
    const bob = await join("Bob")
    const carol = await join("Carol")
    const invite = await createInvite()
    const carolId = (await members()).find((m) => m.name === "Carol")!.id
    const base = `/api/households/${household.id}`

    expect((await api.post(`${base}/invites`, bob)).status).toBe(403)
    expect((await api.get(`${base}/invites`, bob)).status).toBe(403)
    expect((await api.del(`${base}/invites/${invite.id}`, bob)).status).toBe(
      403
    )
    expect((await api.del(`${base}/members/${carolId}`, bob)).status).toBe(403)
    // Nothing changed.
    expect((await members(carol)).length).toBe(3)
  })

  test("can leave a household", async () => {
    const bob = await join("Bob")
    const res = await api.post(`/api/households/${household.id}/leave`, bob)
    expect(res.status).toBe(204)
    expect(await body(await api.get("/api/households", bob))).toEqual({
      households: [],
    })
    expect(
      (await api.get(`/api/households/${household.id}/members`, bob)).status
    ).toBe(404)
  })
})

describe("owners", () => {
  test("can remove a member, who then loses access", async () => {
    const bob = await join("Bob")
    const bobId = (await members()).find((m) => m.name === "Bob")!.id

    const res = await api.del(
      `/api/households/${household.id}/members/${bobId}`,
      owner
    )
    expect(res.status).toBe(204)
    expect((await members()).map((m) => m.name)).toEqual(["Olivia"])

    expect(await body(await api.get("/api/households", bob))).toEqual({
      households: [],
    })
    expect(
      (await api.get(`/api/households/${household.id}/members`, bob)).status
    ).toBe(404)
  })

  test("cannot remove themselves", async () => {
    const me = (await members())[0]!
    const res = await api.del(
      `/api/households/${household.id}/members/${me.id}`,
      owner
    )
    expect(res.status).toBe(400)
  })

  test("cannot leave as the only owner", async () => {
    const res = await api.post(`/api/households/${household.id}/leave`, owner)
    expect(res.status).toBe(400)
    expect((await members()).length).toBe(1)
  })

  test("get 404 for members of another household", async () => {
    const other = await api.signUp("Otto")
    const h = await body<{ household: Household }>(
      await api.post("/api/households", other, { name: "Other" })
    )
    const otto = (
      await body<{ members: Member[] }>(
        await api.get(`/api/households/${h.household.id}/members`, other)
      )
    ).members[0]!
    const res = await api.del(
      `/api/households/${household.id}/members/${otto.id}`,
      owner
    )
    expect(res.status).toBe(404)
  })
})

describe("OpenAPI", () => {
  test("documents the household endpoints", async () => {
    const res = await api.get("/api/openapi.json")
    const doc = await body<{ paths: Record<string, unknown> }>(res)
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        "/api/households",
        "/api/households/{householdId}/members",
        "/api/households/{householdId}/members/{memberId}",
        "/api/households/{householdId}/leave",
        "/api/households/{householdId}/invites",
        "/api/households/{householdId}/invites/{inviteId}",
        "/api/invites/{inviteId}",
        "/api/invites/{inviteId}/accept",
        "/api/invites/{inviteId}/decline",
      ])
    )
  })
})
