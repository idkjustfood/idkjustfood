import { createDatabase } from "@workspace/database"
import { createAi, startExtractionWorker } from "@workspace/extraction"
import { logUncaughtErrors, loggerFromEnv } from "@workspace/logger"

// The worker takes recipe extraction jobs off the pg-boss queue (stored in Postgres)
// and runs them. It needs the same settings as the API: DATABASE_URL and the AI_* variables.
// Logs are JSON lines on the standard output. LOG_LEVEL sets how much is printed.
const logger = loggerFromEnv(process.env, undefined, { service: "worker" })
logUncaughtErrors(logger)

const databaseUrl = process.env.DATABASE_URL ?? ""
const db = createDatabase(databaseUrl)

const stop = await startExtractionWorker(databaseUrl, db, {
  ai: createAi(process.env),
  logger,
})
logger.info("worker started: waiting for recipe extraction jobs")

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logger.info("worker stopping", { signal })
    await stop()
    await db.client.end()
    process.exit(0)
  })
}
