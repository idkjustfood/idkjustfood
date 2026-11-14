import { randomUUID } from "node:crypto"
import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

import type { Logger } from "@workspace/logger"

import type { AuthVariables } from "./session.js"

export type LogVariables = {
  /** The ID of this request. Also sent back in the `X-Request-Id` header. */
  requestId: string
  /** A logger that adds the request ID to every line. */
  log: Logger
}

/** What the logging code reads from the request. `user` is set later by `requireSession`. */
type Env = { Variables: Partial<AuthVariables & LogVariables> }

export const requestIdHeader = "X-Request-Id"

/** A request ID from the caller (for example a reverse proxy) is kept if it is plain. */
const usableId = /^[A-Za-z0-9._-]{8,64}$/

/**
 * Gives each request an ID and logs it when it is done: method, path (without the
 * query, which may carry tokens), status and duration. Unhandled errors are logged
 * by `logUnhandledError`.
 */
export function requestLogging(logger: Logger) {
  return createMiddleware<Env>(async (c, next) => {
    const sent = c.req.header(requestIdHeader)
    const requestId = sent && usableId.test(sent) ? sent : randomUUID()
    const log = logger.child({ requestId })
    c.set("requestId", requestId)
    c.set("log", log)
    c.header(requestIdHeader, requestId)

    const started = performance.now()
    await next()

    const status = c.res.status
    // The health check runs every few seconds; keep it out of the normal output.
    const quiet = c.req.path === "/health" && status < 400
    const write = quiet
      ? log.debug
      : status >= 500
        ? log.error
        : status >= 400
          ? log.warn
          : log.info
    write("request", {
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: Math.round(performance.now() - started),
      userId: c.get("user")?.id,
    })
  })
}

/** Hono's error handler: logs the error with its stack and the request ID, answers 500. */
export function logUnhandledError(logger: Logger) {
  return (err: Error, c: Context<Env>) => {
    logger.error("unhandled error", {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      err,
    })
    return c.json({ error: "Internal Server Error" }, 500)
  }
}
