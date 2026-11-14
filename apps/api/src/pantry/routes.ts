import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import type { Database } from "@workspace/database"
import {
  PantryItemInputSchema,
  PantryItemSchema,
  PantryResetSchema,
  PantrySchema,
  RecipeLanguageSchema,
  type Pantry,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { pantryStore, type PantryRow } from "./store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Household not found" }) })
  .openapi("Error")

const PantryBody = PantrySchema.openapi("Pantry")
const ItemBody = PantryItemSchema.openapi("PantryItem")
const ItemInputBody = PantryItemInputSchema.openapi("PantryItemInput")
const ResetBody = PantryResetSchema.openapi("PantryReset")

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})
const error = (description: string) => json(ErrorSchema, description)
const body = <T extends z.ZodType>(schema: T) => ({
  content: { "application/json": { schema } },
  required: true as const,
})

const signedIn = { 401: error("Not signed in") }
const tags = ["Pantry"]
const security = [{ cookieAuth: [] }]
const noHousehold = error("Household not found, or you are not a member")

const spaceDescription =
  "Without `householdId` this is your own pantry; with it, the pantry of that household. " +
  "A pantry is made with the default list the first time it is needed. " +
  "`language` (`en`, `de`, `es`, `fr` or `it`) picks the default list's language."

const getPantry = createRoute({
  method: "get",
  path: "/pantry",
  tags,
  security,
  summary: "Get the pantry staples",
  description:
    "The things you always have at home. They are left out when a recipe's ingredients are added to a " +
    `shopping list. ${spaceDescription}`,
  request: {
    query: z.object({
      householdId: z.string().optional(),
      language: RecipeLanguageSchema.optional(),
    }),
  },
  responses: {
    200: json(z.object({ pantry: PantryBody }), "The pantry"),
    404: noHousehold,
    ...signedIn,
  },
})

const addItem = createRoute({
  method: "post",
  path: "/pantry/items",
  tags,
  security,
  summary: "Add a pantry staple",
  description:
    'Names are compared without upper/lower case and extra spaces, so adding "salt" when "Salt" is ' +
    `there returns the existing one. You may choose the \`id\`. ${spaceDescription}`,
  request: { body: body(ItemInputBody) },
  responses: {
    201: json(z.object({ item: ItemBody }), "Added, or already there"),
    400: error("Invalid item"),
    404: noHousehold,
    409: error("That id is already used by another item"),
    ...signedIn,
  },
})

const removeItem = createRoute({
  method: "delete",
  path: "/pantry/items/{itemId}",
  tags,
  security,
  summary: "Remove a pantry staple",
  request: {
    params: z.object({
      itemId: z.string().openapi({ param: { name: "itemId", in: "path" } }),
    }),
  },
  responses: {
    204: { description: "Removed" },
    404: error("The item doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

const resetPantry = createRoute({
  method: "post",
  path: "/pantry/reset",
  tags,
  security,
  summary: "Reset the pantry to the default list",
  description: `Replaces the whole list. Items that were added are removed. ${spaceDescription}`,
  request: { body: body(ResetBody) },
  responses: {
    200: json(z.object({ pantry: PantryBody }), "The default list"),
    404: noHousehold,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }

/** Pantry endpoints. Mounted under /api. */
export function pantryRoutes(db: Database, auth: Auth) {
  const store = pantryStore(db)

  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = issue?.path.join(".")
        return c.json(
          { error: field ? `${field}: ${issue?.message}` : "Invalid request" },
          400
        )
      }
    },
  })

  for (const path of ["/pantry", "/pantry/*"]) {
    app.use(path, requireSession(auth))
  }

  async function whole(row: PantryRow): Promise<Pantry> {
    const items = await store.items(row.id)
    return {
      householdId: row.organizationId,
      items: items.map(({ id, name }) => ({ id, name })),
    }
  }

  app.openapi(getPantry, async (c) => {
    const { householdId, language } = c.req.valid("query")
    const row = await store.access(
      c.get("user").id,
      householdId ?? null,
      language
    )
    if (!row) return c.json({ error: "Household not found" }, 404)
    return c.json({ pantry: await whole(row) }, 200)
  })

  app.openapi(addItem, async (c) => {
    const { id, name, householdId, language } = c.req.valid("json")
    const row = await store.access(
      c.get("user").id,
      householdId ?? null,
      language
    )
    if (!row) return c.json({ error: "Household not found" }, 404)
    const item = await store.addItem(row.id, name, id)
    if (!item) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ item: { id: item.id, name: item.name } }, 201)
  })

  app.openapi(removeItem, async (c) => {
    const row = await store.accessItem(
      c.get("user").id,
      c.req.valid("param").itemId
    )
    if (
      !row ||
      !(await store.removeItem(row.id, c.req.valid("param").itemId))
    ) {
      return c.json({ error: "Item not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(resetPantry, async (c) => {
    const { householdId, language } = c.req.valid("json")
    const row = await store.access(
      c.get("user").id,
      householdId ?? null,
      language
    )
    if (!row) return c.json({ error: "Household not found" }, 404)
    await store.reset(row.id, language)
    return c.json({ pantry: await whole(row) }, 200)
  })

  return app
}
