import { PGlite } from "@electric-sql/pglite"
import { readdirSync, readFileSync } from "node:fs"
import { drizzle } from "drizzle-orm/pglite"
import { beforeAll, describe, expect, test } from "bun:test"

import { schema, type Database } from "@workspace/database"

import { createApp } from "./app.js"
import { socialProvidersFromEnv } from "./auth.js"

const migrationsDir = new URL(
  "../../../packages/database/drizzle/",
  import.meta.url
)
const migration = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(new URL(file, migrationsDir), "utf8"))
  .join("--> statement-breakpoint")

const env = {
  BETTER_AUTH_URL: "http://localhost:3001",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-00",
}

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

describe("auth API", () => {
  let app: ReturnType<typeof createApp>

  beforeAll(async () => {
    const pg = new PGlite()
    for (const statement of migration.split("--> statement-breakpoint")) {
      await pg.exec(statement)
    }
    const db = drizzle(pg, { schema }) as unknown as Database
    app = createApp(db, env)
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

  test("wrong password is rejected", async () => {
    const res = await json("/api/auth/sign-in/email", {
      email: "ada@example.com",
      password: "wrong-password-123",
    })
    expect(res.status).toBe(401)
  })
})
