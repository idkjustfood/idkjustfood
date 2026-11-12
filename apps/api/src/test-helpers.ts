import { PGlite } from "@electric-sql/pglite"
import { readdirSync, readFileSync } from "node:fs"
import { drizzle } from "drizzle-orm/pglite"

import { schema, type Database } from "@workspace/database"

import { createApp } from "./app.js"

export const testEnv = {
  BETTER_AUTH_URL: "http://localhost:3001",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-00",
}

const migrationsDir = new URL(
  "../../../packages/database/drizzle/",
  import.meta.url
)

/** An in-memory Postgres with all migrations applied. */
export async function createTestDb() {
  const pg = new PGlite()
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  for (const file of files) {
    const sql = readFileSync(new URL(file, migrationsDir), "utf8")
    for (const statement of sql.split("--> statement-breakpoint")) {
      await pg.exec(statement)
    }
  }
  return drizzle(pg, { schema }) as unknown as Database
}

type App = ReturnType<typeof createApp>

/** Small request helpers for tests. */
export function client(app: App) {
  async function request(
    method: string,
    path: string,
    cookie?: string,
    body?: unknown
  ) {
    return app.request(path, {
      method,
      headers: {
        origin: testEnv.BETTER_AUTH_URL,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  /** Signs up a new user and returns their session cookie. */
  async function signUp(name: string) {
    const email = `${name.toLowerCase()}@example.com`
    const res = await request("POST", "/api/auth/sign-up/email", undefined, {
      name,
      email,
      password: "correct-horse-battery",
    })
    if (res.status !== 200) throw new Error(`sign up failed: ${res.status}`)
    return res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
  }

  return {
    request,
    signUp,
    get: (path: string, cookie?: string) => request("GET", path, cookie),
    post: (path: string, cookie?: string, body?: unknown) =>
      request("POST", path, cookie, body ?? {}),
    del: (path: string, cookie?: string) => request("DELETE", path, cookie),
  }
}
