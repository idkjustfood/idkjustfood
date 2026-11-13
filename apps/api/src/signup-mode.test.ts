import { describe, expect, test } from "bun:test"

import { createApp } from "./app.js"
import { signupModeFromEnv } from "./signup-mode.js"
import { client, createTestDb, testEnv } from "./test-helpers.js"

type Config = {
  signupMode: string
  signupOpen: boolean
  socialProviders: string[]
}
type Me = { user: { role?: string } }

async function setUp(mode?: string) {
  const env: Record<string, string | undefined> = { ...testEnv }
  if (mode === undefined) delete env.SIGNUP_MODE
  else env.SIGNUP_MODE = mode
  const app = createApp(await createTestDb(), env)
  const api = client(app)
  const config = async () =>
    (await api.get("/api/config")).json() as Promise<Config>
  const role = async (cookie: string) =>
    ((await (await api.get("/api/me", cookie)).json()) as Me).user.role
  /** Raw sign-up, so tests can look at the answer and add an invite header. */
  const trySignUp = (name: string, invite?: string) =>
    app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: testEnv.BETTER_AUTH_URL,
        ...(invite ? { "x-invite-id": invite } : {}),
      },
      body: JSON.stringify({
        name,
        email: `${name.toLowerCase()}@example.com`,
        password: "correct-horse-battery",
      }),
    })
  return { api, config, role, trySignUp }
}

describe("SIGNUP_MODE setting", () => {
  test("defaults to first-user-only", () => {
    expect(signupModeFromEnv({})).toBe("first-user-only")
    expect(signupModeFromEnv({ SIGNUP_MODE: "" })).toBe("first-user-only")
  })

  test("accepts the three modes", () => {
    for (const mode of ["first-user-only", "invite", "open"]) {
      expect(signupModeFromEnv({ SIGNUP_MODE: mode })).toBe(mode as never)
    }
  })

  test("rejects a typo instead of guessing", () => {
    expect(() => signupModeFromEnv({ SIGNUP_MODE: "opn" })).toThrow(
      /SIGNUP_MODE/
    )
  })
})

describe("first-user-only (the default)", () => {
  test("first sign-up works and becomes admin, the second is rejected", async () => {
    const { api, config, role, trySignUp } = await setUp()
    expect(await config()).toEqual({
      signupMode: "first-user-only",
      signupOpen: true,
      socialProviders: [],
    })

    const first = await trySignUp("Ada")
    expect(first.status).toBe(200)
    const cookie = first.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
    expect(await role(cookie)).toBe("admin")

    const second = await trySignUp("Bob")
    expect(second.status).toBe(403)
    expect(((await second.json()) as { message: string }).message).toMatch(
      /Registration is closed/
    )
    expect((await config()).signupOpen).toBe(false)

    // The existing user can still sign in.
    const login = await api.post("/api/auth/sign-in/email", undefined, {
      email: "ada@example.com",
      password: "correct-horse-battery",
    })
    expect(login.status).toBe(200)
  })

  test("an invite link does not open registration", async () => {
    const { api, trySignUp } = await setUp()
    const owner = await api.signUp("Ada")
    const household = await api.post("/api/households", owner, { name: "Home" })
    const { household: h } = (await household.json()) as {
      household: { id: string }
    }
    const invite = await api.post(`/api/households/${h.id}/invites`, owner)
    const { invite: i } = (await invite.json()) as { invite: { id: string } }
    expect((await trySignUp("Bob", i.id)).status).toBe(403)
  })
})

describe("invite", () => {
  test("sign-up needs a valid invite link, except for the first account", async () => {
    const { api, config, role, trySignUp } = await setUp("invite")
    expect((await config()).signupOpen).toBe(true) // nobody yet: the first account

    const adaRes = await trySignUp("Ada")
    expect(adaRes.status).toBe(200)
    const ada = adaRes.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
    expect(await role(ada)).toBe("admin")
    expect((await config()).signupOpen).toBe(false)

    const household = await api.post("/api/households", ada, { name: "Home" })
    const { household: h } = (await household.json()) as {
      household: { id: string }
    }
    const created = await api.post(`/api/households/${h.id}/invites`, ada)
    const { invite } = (await created.json()) as { invite: { id: string } }

    expect((await trySignUp("Bob")).status).toBe(403)
    expect((await trySignUp("Bob", "not-a-real-invite")).status).toBe(403)

    const bob = await trySignUp("Bob", invite.id)
    expect(bob.status).toBe(200)
    const bobCookie = bob.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
    expect(await role(bobCookie)).toBe("user")
  })

  test("a cancelled invite no longer works", async () => {
    const { api, trySignUp } = await setUp("invite")
    const ada = await api.signUp("Ada")
    const household = await api.post("/api/households", ada, { name: "Home" })
    const { household: h } = (await household.json()) as {
      household: { id: string }
    }
    const created = await api.post(`/api/households/${h.id}/invites`, ada)
    const { invite } = (await created.json()) as { invite: { id: string } }
    await api.del(`/api/households/${h.id}/invites/${invite.id}`, ada)
    expect((await trySignUp("Bob", invite.id)).status).toBe(403)
  })
})

describe("open", () => {
  test("anyone can register and only the first is admin", async () => {
    const { api, config, role } = await setUp("open")
    expect(await config()).toMatchObject({
      signupMode: "open",
      signupOpen: true,
    })
    const ada = await api.signUp("Ada")
    const bob = await api.signUp("Bob")
    expect(await role(ada)).toBe("admin")
    expect(await role(bob)).toBe("user")
    expect((await config()).signupOpen).toBe(true)
  })
})
