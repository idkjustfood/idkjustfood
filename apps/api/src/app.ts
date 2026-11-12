import { Hono } from "hono"
import { cors } from "hono/cors"

import type { Database } from "@workspace/database"

import { createAuth, type AuthEnv } from "./auth.js"
import { requireSession, type AuthVariables } from "./session.js"

/** Builds the API. Takes the database and settings so tests can use their own. */
export function createApp(db: Database, env: AuthEnv) {
  const auth = createAuth(db, env)
  const app = new Hono<{ Variables: Partial<AuthVariables> }>()

  if (env.APP_URL) {
    app.use("/api/auth/*", cors({ origin: env.APP_URL, credentials: true }))
  }

  app.get("/health", (c) => c.json({ status: "ok" }))

  // Better Auth handles sign-up, sign-in, sessions, organizations and OAuth.
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

  // Example of a protected route. Real routes use the same middleware.
  app.get("/api/me", requireSession(auth), (c) =>
    c.json({ user: c.get("user") })
  )

  return app
}
