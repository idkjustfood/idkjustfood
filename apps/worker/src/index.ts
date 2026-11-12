import { createDatabase } from "@workspace/database"
import { createAi, startExtractionWorker } from "@workspace/extraction"

// The worker takes recipe extraction jobs off the pg-boss queue (stored in Postgres)
// and runs them. It needs the same settings as the API: DATABASE_URL and the AI_* variables.
const databaseUrl = process.env.DATABASE_URL ?? ""
const db = createDatabase(databaseUrl)

const stop = await startExtractionWorker(databaseUrl, db, {
  ai: createAi(process.env),
})
console.log("worker started: waiting for recipe extraction jobs")

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await stop()
    await db.client.end()
    process.exit(0)
  })
}
