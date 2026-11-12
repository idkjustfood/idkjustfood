import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema/index.js"

export { schema }

/** Creates a Drizzle database connection from a Postgres connection URL. */
export function createDatabase(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set")
  }
  const client = postgres(databaseUrl)
  return Object.assign(drizzle(client, { schema }), { client })
}

export type Database = ReturnType<typeof createDatabase>
