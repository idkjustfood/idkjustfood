// Writes the OpenAPI document to apps/api/openapi.json, the file the app's typed
// client is generated from. Run with `bun run openapi` after changing a route.
import { writeFileSync } from "node:fs"

import type { Database } from "@workspace/database"

import { createApp, openApiConfig } from "./app.js"

export const openApiFile = new URL("../openapi.json", import.meta.url)

/** The OpenAPI document as text. Needs no database or real settings. */
export function openApiText() {
  const app = createApp({} as Database, {
    BETTER_AUTH_URL: "http://localhost:3001",
    BETTER_AUTH_SECRET: "openapi-only-secret-not-used-at-runtime",
  })
  return JSON.stringify(app.getOpenAPI31Document(openApiConfig), null, 2) + "\n"
}

if (import.meta.main) {
  writeFileSync(openApiFile, openApiText())
  console.log("Wrote apps/api/openapi.json")
}
