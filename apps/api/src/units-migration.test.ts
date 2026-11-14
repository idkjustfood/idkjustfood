import { PGlite } from "@electric-sql/pglite"
import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

import { isUnitKey } from "@workspace/schemas"

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

describe("migration to the fixed list of units", () => {
  test("old recipes and shopping items get units from the list", async () => {
    const pg = new PGlite()
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
    const last = files.findIndex((file) => file.includes("ingredient_units"))
    expect(last).toBeGreaterThan(0)
    for (const file of files.slice(0, last)) await run(pg, file)

    // The rows are made without their users and lists: only the units matter here.
    await pg.exec("SET session_replication_role = replica")
    const ingredients: {
      name: string
      quantity: number | null
      unit: string | null
      note: string | null
    }[] = [
      { name: "flour", quantity: 200, unit: "grams", note: null },
      { name: "flour", quantity: 100, unit: "g", note: null },
      { name: "Öl", quantity: 2, unit: "EL", note: "kalt" },
      { name: "Mehl", quantity: 1, unit: " Esslöffel. ", note: null },
      { name: "Knoblauch", quantity: 2, unit: "Zehen", note: null },
      { name: "basil", quantity: 1, unit: "handful", note: "torn" },
      { name: "pepper", quantity: 1, unit: "dash", note: null },
      { name: "salt", quantity: null, unit: null, note: null },
      { name: "oil", quantity: 1, unit: "", note: null },
    ]
    await pg.query(
      `INSERT INTO "recipe" ("id", "user_id", "title", "servings", "ingredients", "steps", "nutrition", "source")
       VALUES ('r1', 'u1', 'Test', 2, $1::jsonb, '[]', '{}', '{"kind":"manual","label":null,"url":null}')`,
      [JSON.stringify(ingredients)]
    )
    await pg.exec(`INSERT INTO "recipe" ("id", "user_id", "title", "servings", "ingredients", "steps", "nutrition", "source")
       VALUES ('r2', 'u1', 'Empty', 2, '[]', '[]', '{}', '{"kind":"manual","label":null,"url":null}')`)
    await pg.exec(`INSERT INTO "shopping_item" ("id", "list_id", "name", "quantity", "unit", "note")
       VALUES ('i1', 'l1', 'Milk', 1, 'Liter', NULL),
              ('i2', 'l1', 'Basil', 1, 'handful', 'fresh'),
              ('i3', 'l1', 'Eggs', 6, NULL, NULL),
              ('i4', 'l1', 'Rice', 1, 'kg', NULL)`)

    await run(pg, files[last]!)

    const recipe = await pg.query<{ ingredients: typeof ingredients }>(
      `SELECT "ingredients" FROM "recipe" WHERE "id" = 'r1'`
    )
    expect(recipe.rows[0]!.ingredients).toEqual([
      { name: "flour", quantity: 200, unit: "g", note: null },
      { name: "flour", quantity: 100, unit: "g", note: null },
      { name: "Öl", quantity: 2, unit: "tbsp", note: "kalt" },
      { name: "Mehl", quantity: 1, unit: "tbsp", note: null },
      { name: "Knoblauch", quantity: 2, unit: "clove", note: null },
      // Not in the list: the amount stays, the old word goes into the note.
      { name: "basil", quantity: 1, unit: null, note: "handful, torn" },
      { name: "pepper", quantity: 1, unit: null, note: "dash" },
      { name: "salt", quantity: null, unit: null, note: null },
      { name: "oil", quantity: 1, unit: null, note: null },
    ])
    for (const item of recipe.rows[0]!.ingredients) {
      expect(item.unit === null || isUnitKey(item.unit)).toBe(true)
    }

    const empty = await pg.query<{ ingredients: unknown }>(
      `SELECT "ingredients" FROM "recipe" WHERE "id" = 'r2'`
    )
    expect(empty.rows[0]!.ingredients).toEqual([])

    const items = await pg.query<{ id: string; unit: string | null; note: string | null }>(
      `SELECT "id", "unit", "note" FROM "shopping_item" ORDER BY "id"`
    )
    expect(items.rows).toEqual([
      { id: "i1", unit: "l", note: null },
      { id: "i2", unit: null, note: "handful, fresh" },
      { id: "i3", unit: null, note: null },
      { id: "i4", unit: "kg", note: null },
    ])
  })
})
