import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"

import { openApiFile, openApiText } from "./openapi.js"

test("openapi.json is up to date (run `bun run openapi` in apps/api)", () => {
  // Git may check the file out with Windows line endings.
  const onDisk = readFileSync(openApiFile, "utf8").replace(/\r\n/g, "\n")
  expect(onDisk).toBe(openApiText())
})
