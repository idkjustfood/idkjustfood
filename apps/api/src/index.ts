import { createDatabase } from "@workspace/database"

// Keep this import first: it loads @hono/zod-openapi, which must be loaded before the
// shared Zod schemas are created (@workspace/schemas, loaded by @workspace/extraction).
import { createApp } from "./app.js"

import { createJobQueue } from "@workspace/extraction"

const databaseUrl = process.env.DATABASE_URL ?? ""
const db = createDatabase(databaseUrl)
// Extraction jobs are queued in Postgres (pg-boss) and run by the worker.
const queue = await createJobQueue(databaseUrl)
const app = createApp(db, process.env, { queue })

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
}
