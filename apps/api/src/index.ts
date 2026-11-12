import { createDatabase } from "@workspace/database"

import { createApp } from "./app.js"

const db = createDatabase(process.env.DATABASE_URL ?? "")
const app = createApp(db, process.env)

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
}
