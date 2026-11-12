import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/postgres-js/migrator"

import { createDatabase } from "./index.js"

// Applies the SQL migrations in ./drizzle. Run by the `migrate` service in docker-compose.yml.
const db = createDatabase(process.env.DATABASE_URL ?? "")
await migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
})
await db.client.end()
console.log("Migrations applied")
