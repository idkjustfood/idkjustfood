import { beforeAll, describe, expect, test } from "bun:test"

import type { Database } from "@workspace/database"

import { createApp } from "./app.js"
import { socialProvidersFromEnv } from "./auth.js"
import { createTestDb, testEnv as env } from "./test-helpers.js"

describe("social providers", () => {
  test("are left out without keys", () => {
    expect(socialProvidersFromEnv({})).toEqual({})
    expect(socialProvidersFromEnv({ GOOGLE_CLIENT_ID: "id" })).toEqual({})
  })

  test("are active when id and secret are set", () => {
    const providers = socialProvidersFromEnv({
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "gs",
      GITHUB_CLIENT_ID: "h",
      GITHUB_CLIENT_SECRET: "hs",
    })
    expect(Object.keys(providers)).toEqual(["google", "github"])
  })
})

describe("auth config endpoint", () => {
  const fakeDb = {} as Database

  test("lists only the configured social providers", async () => {
    const app = createApp(fakeDb, {
      ...env,
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "gs",
    })
    const res = await app.request("/api/config")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      socialProviders: ["google"],
      signupMode: "open",
      signupOpen: true,
    })
  })

  test("allows the app origin to call it from the browser", async () => {
    const app = createApp(fakeDb, { ...env, APP_URL: "http://localhost:8081" })
    const res = await app.request("/api/config", {
      headers: { origin: "http://localhost:8081" },
    })
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:8081"
    )
  })

  test("lists none without keys", async () => {
    const res = await createApp(fakeDb, env).request("/api/config")
    expect(await res.json()).toEqual({
      socialProviders: [],
      signupMode: "open",
      signupOpen: true,
    })
  })
})

describe("auth API", () => {
  let app: ReturnType<typeof createApp>

  beforeAll(async () => {
    app = createApp(await createTestDb(), env)
  })

  const json = (path: string, body: unknown, cookie?: string) =>
    app.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })

  const cookieFrom = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")

  test("sign up, sign in, read session, create organization", async () => {
    const up = await json("/api/auth/sign-up/email", {
      name: "Ada",
      email: "ada@example.com",
      password: "correct-horse-battery",
    })
    expect(up.status).toBe(200)

    const inRes = await json("/api/auth/sign-in/email", {
      email: "ada@example.com",
      password: "correct-horse-battery",
    })
    expect(inRes.status).toBe(200)
    const cookie = cookieFrom(inRes)

    const me = await app.request("/api/me", { headers: { cookie } })
    expect(me.status).toBe(200)
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe(
      "ada@example.com"
    )

    const org = await json(
      "/api/auth/organization/create",
      { name: "Home", slug: "home" },
      cookie
    )
    expect(org.status).toBe(200)

    const invite = await json(
      "/api/auth/organization/invite-member",
      { email: "bob@example.com", role: "member" },
      cookie
    )
    expect(invite.status).toBe(200)
  })

  test("protected route rejects anonymous requests", async () => {
    expect((await app.request("/api/me")).status).toBe(401)
  })

  test("change password: wrong current fails, new one works, old one stops working", async () => {
    const signIn = (password: string) =>
      json("/api/auth/sign-in/email", { email: "ada@example.com", password })
    const cookie = cookieFrom(await signIn("correct-horse-battery"))

    const wrong = await json(
      "/api/auth/change-password",
      { currentPassword: "not-the-password", newPassword: "brand-new-password" },
      cookie
    )
    expect(wrong.status).toBe(400)
    expect((await signIn("brand-new-password")).status).toBe(401)

    const short = await json(
      "/api/auth/change-password",
      { currentPassword: "correct-horse-battery", newPassword: "short" },
      cookie
    )
    expect(short.status).toBe(400)

    const ok = await json(
      "/api/auth/change-password",
      { currentPassword: "correct-horse-battery", newPassword: "brand-new-password" },
      cookie
    )
    expect(ok.status).toBe(200)
    expect((await signIn("brand-new-password")).status).toBe(200)
    expect((await signIn("correct-horse-battery")).status).toBe(401)

    // Put it back so the tests below keep working.
    const back = await json(
      "/api/auth/change-password",
      { currentPassword: "brand-new-password", newPassword: "correct-horse-battery" },
      cookie
    )
    expect(back.status).toBe(200)
  })

  test("wrong password is rejected", async () => {
    const res = await json("/api/auth/sign-in/email", {
      email: "ada@example.com",
      password: "wrong-password-123",
    })
    expect(res.status).toBe(401)
  })
})
