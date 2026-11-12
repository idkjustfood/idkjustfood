// Only used by the Better Auth CLI to read the auth setup (see
// .claude/rules/better-auth-migrations.md). It never connects to a database.
import { createDatabase } from "@workspace/database"

import { createAuth } from "./src/auth.js"

export const auth = createAuth(
  createDatabase("postgres://cli:cli@localhost:5432/cli"),
  {
    BETTER_AUTH_URL: "http://localhost:3001",
    BETTER_AUTH_SECRET: "cli-only-secret-not-used-at-runtime-0000",
  }
)
