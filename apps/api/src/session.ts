import { createMiddleware } from "hono/factory"

import type { Auth } from "./auth.js"

type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>

export type AuthVariables = {
  user: Session["user"]
  session: Session["session"]
}

/**
 * Requires a signed-in user. Responds with 401 otherwise.
 * Routes behind it read the user with `c.get("user")`.
 */
export function requireSession(auth: Auth) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!result) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    c.set("user", result.user)
    c.set("session", result.session)
    await next()
  })
}
