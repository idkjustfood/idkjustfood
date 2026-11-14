import { PGlite } from "@electric-sql/pglite"
import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

const migrationsDir = new URL(
  "../../../packages/database/drizzle/",
  import.meta.url
)

async function run(pg: PGlite, file: string) {
  const sql = readFileSync(new URL(file, migrationsDir), "utf8")
  for (const statement of sql.split("--> statement-breakpoint")) {
    await pg.exec(statement)
  }
}

describe("migration to the fixed list of tags", () => {
  test("old recipes keep the tags that are on the list and lose the rest", async () => {
    const pg = new PGlite()
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
    const last = files.findIndex((file) => file.includes("fixed_tags"))
    expect(last).toBeGreaterThan(0)
    for (const file of files.slice(0, last)) await run(pg, file)

    // The rows are made without their users: only the tags matter here.
    await pg.exec("SET session_replication_role = replica")
    const insert = (id: string, tags: string[]) =>
      pg.query(
        `INSERT INTO "recipe" ("id", "user_id", "title", "servings", "tags", "ingredients", "steps", "nutrition", "source")
         VALUES ($1, 'u1', 'Test', 2, $2::text[], '[]', '[]', '{}', '{"kind":"manual","label":null,"url":null}')`,
        [id, tags]
      )
    await insert("r1", ["Italian", "italienisch", "Spicy", "Vegan", "Under 30 min"])
    await insert("r2", ["Breakfast", "Gluten-free", "high protein", "Lunch"])
    await insert("r3", ["tasty", "Over 1 hour"])
    await insert("r4", [])

    await run(pg, files[last]!)

    const result = await pg.query<{ id: string; tags: string[] }>(
      `SELECT "id", "tags" FROM "recipe" ORDER BY "id"`
    )
    expect(result.rows.map((r) => r.tags)).toEqual([
      // In the order of the list: cuisine, diet, time.
      ["italian", "vegan", "under_30_min"],
      ["gluten_free", "high_protein", "breakfast", "midday"],
      [],
      [],
    ])
  })
})
