import { createDatabase } from "@workspace/database"

// Keep this import first: it loads @hono/zod-openapi, which must be loaded before the
// shared Zod schemas are created (@workspace/schemas, loaded by @workspace/extraction).
import { createApp } from "./app.js"

import { createJobQueue } from "@workspace/extraction"
import { logUncaughtErrors, loggerFromEnv } from "@workspace/logger"

// JSON log lines on the standard output. LOG_LEVEL sets how much is printed.
const logger = loggerFromEnv(process.env, undefined, { service: "api" })
logUncaughtErrors(logger)

const databaseUrl = process.env.DATABASE_URL ?? ""
const db = createDatabase(databaseUrl)
// Extraction jobs are queued in Postgres (pg-boss) and run by the worker.
const queue = await createJobQueue(databaseUrl, logger)
const app = createApp(db, process.env, { queue, logger })

const port = Number(process.env.PORT ?? 3001)
logger.info("api started", { port })

export default {
  port,
  fetch: app.fetch,
}
