import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import { schema, type Database } from "@workspace/database"
import {
  InventoryItemInputSchema,
  InventoryItemSchema,
  InventoryItemUpdateSchema,
  type InventoryItem,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { spaceStore } from "../space-store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Item not found" }) })
  .openapi("Error")

const Body = InventoryItemSchema.openapi("InventoryItem")
const InputBody = InventoryItemInputSchema.openapi("InventoryItemInput")
const UpdateBody = InventoryItemUpdateSchema.openapi("InventoryItemUpdate")

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
const tags = ["Inventory"]
const security = [{ cookieAuth: [] }]
const notFound = error("The item doesn't exist, or you can't see it")

const idParam = z.object({
  itemId: z.string().openapi({ param: { name: "itemId", in: "path" } }),
})

const list = createRoute({
  method: "get",
  path: "/inventory",
  tags,
  security,
  summary: "List items",
  description:
    "Your own items and the items of your households. With `householdId`, only the " +
    "items of that household.",
  request: { query: z.object({ householdId: z.string().optional() }) },
  responses: {
    200: json(z.object({ items: z.array(Body) }), "The items"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const create = createRoute({
  method: "post",
  path: "/inventory",
  tags,
  security,
  summary: "Add an item",
  description:
    "`householdId` shares the item with a household; without it the item is personal. " +
    "You may choose the `id`. Sending an id that already exists returns that item and " +
    "changes nothing.",
  request: { body: body(InputBody) },
  responses: {
    201: json(z.object({ item: Body }), "Added, or already there"),
    400: error("Invalid item"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's item"),
    ...signedIn,
  },
})

const update = createRoute({
  method: "patch",
  path: "/inventory/{itemId}",
  tags,
  security,
  summary: "Change an item",
  description: "Everyone who can see the item can change it.",
  request: { params: idParam, body: body(UpdateBody) },
  responses: {
    200: json(z.object({ item: Body }), "The changed item"),
    400: error("Invalid change"),
    404: notFound,
    ...signedIn,
  },
})

const remove = createRoute({
  method: "delete",
  path: "/inventory/{itemId}",
  tags,
  security,
  summary: "Delete an item",
  description: "Everyone who can see the item can delete it.",
  request: { params: idParam },
  responses: {
    204: { description: "Deleted" },
    404: notFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }
type Row = typeof schema.inventoryItem.$inferSelect

const toInventoryItem = (row: Row): InventoryItem => ({
  id: row.id,
  name: row.name,
  place: row.place,
  quantity: row.quantity,
  note: row.note,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

/** Inventory endpoints. Mounted under /api. */
export function inventoryRoutes(db: Database, auth: Auth) {
  const store = spaceStore(db, schema.inventoryItem)

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

  for (const path of ["/inventory", "/inventory/*"]) {
    app.use(path, requireSession(auth))
  }

  app.openapi(list, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await store.forSpace(userId, householdId)
      : await store.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ items: rows.map(toInventoryItem) }, 200)
  })

  app.openapi(create, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await store.create(userId, input, {
      name: input.name,
      place: input.place ?? "",
      quantity: input.quantity ?? 1,
      note: input.note ?? "",
    })
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ item: toInventoryItem(result.row) }, 201)
  })

  app.openapi(update, async (c) => {
    const { itemId } = c.req.valid("param")
    if (!(await store.access(itemId, c.get("user").id))) {
      return c.json({ error: "Item not found" }, 404)
    }
    const row = await store.update(itemId, c.req.valid("json"))
    if (!row) return c.json({ error: "Item not found" }, 404)
    return c.json({ item: toInventoryItem(row) }, 200)
  })

  app.openapi(remove, async (c) => {
    const { itemId } = c.req.valid("param")
    if (
      !(await store.access(itemId, c.get("user").id)) ||
      !(await store.remove(itemId))
    ) {
      return c.json({ error: "Item not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
