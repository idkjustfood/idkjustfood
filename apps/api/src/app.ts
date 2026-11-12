import { OpenAPIHono } from "@hono/zod-openapi"
import { cors } from "hono/cors"

import type { Database } from "@workspace/database"
import type { InputModule, JobQueue } from "@workspace/extraction"

import { createAuth, socialProvidersFromEnv, type AuthEnv } from "./auth.js"
import { extractionRoutes } from "./extractions/routes.js"
import { householdRoutes } from "./households/routes.js"
import { recipeRoutes } from "./recipes/routes.js"
import { requireSession, type AuthVariables } from "./session.js"

/** Settings for the OpenAPI document served at /api/openapi.json. */
export const openApiConfig = {
  openapi: "3.1.0",
  info: {
    title: "idkjustfood API",
    version: "0.0.1",
    description:
      "Sign-in and sessions are handled by Better Auth under /api/auth/*. " +
      "Signed-in requests send the session cookie it sets.",
  },
}

export type AppDeps = {
  /** Where extraction jobs are queued. The server uses pg-boss; tests use a fake. */
  queue?: JobQueue
  /** Input modules to use instead of the built-in ones (tests). */
  modules?: InputModule[]
}

const noQueue: JobQueue = {
  enqueue: async () => {
    throw new Error("No job queue is configured")
  },
}

/** Builds the API. Takes the database and settings so tests can use their own. */
export function createApp(db: Database, env: AuthEnv, deps: AppDeps = {}) {
  const auth = createAuth(db, env)
  const app = new OpenAPIHono<{ Variables: Partial<AuthVariables> }>()

  if (env.APP_URL) {
    app.use("/api/*", cors({ origin: env.APP_URL, credentials: true }))
  }

  app.get("/health", (c) => c.json({ status: "ok" }))

  // Tells the app which sign-in options this server has turned on.
  app.get("/api/config", (c) =>
    c.json({ socialProviders: Object.keys(socialProvidersFromEnv(env)) })
  )

  // Better Auth handles sign-up, sign-in, sessions, organizations and OAuth.
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

  // Example of a protected route. Real routes use the same middleware.
  app.get("/api/me", requireSession(auth), (c) =>
    c.json({ user: c.get("user") })
  )

  // Households: members and invite links.
  app.route("/api", householdRoutes(db, auth, env))

  // Recipes: create, read, update, delete, search.
  app.route("/api", recipeRoutes(db, auth))

  // Recipe extraction: add a recipe from a link, a photo or text (runs in the worker).
  app.route(
    "/api",
    extractionRoutes(db, auth, env, {
      queue: deps.queue ?? noQueue,
      modules: deps.modules,
    })
  )

  app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description: "Session cookie set by Better Auth when you sign in.",
  })
  app.doc31("/api/openapi.json", openApiConfig)

  return app
}
