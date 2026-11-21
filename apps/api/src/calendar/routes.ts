import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import type { Database } from "@workspace/database"
import {
  CalendarEntryInputSchema,
  CalendarEntrySchema,
  CalendarEntryUpdateSchema,
  type CalendarEntry,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { calendarStore, type CalendarEntryRow } from "./store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Calendar entry not found" }) })
  .openapi("Error")

const EntryBody = CalendarEntrySchema.openapi("CalendarEntry")
const InputBody = CalendarEntryInputSchema.openapi("CalendarEntryInput")
const UpdateBody = CalendarEntryUpdateSchema.openapi("CalendarEntryUpdate")

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
const tags = ["Calendar"]
const security = [{ cookieAuth: [] }]
const notFound = error("The entry doesn't exist, or you can't see it")

const entryId = z.object({
  entryId: z.string().openapi({ param: { name: "entryId", in: "path" } }),
})

const listEntries = createRoute({
  method: "get",
  path: "/calendar",
  tags,
  security,
  summary: "List calendar entries",
  description:
    "Your own entries and the entries of your households. With `householdId`, only the entries " +
    "of that household. Entries are sorted by day.",
  request: { query: z.object({ householdId: z.string().optional() }) },
  responses: {
    200: json(z.object({ entries: z.array(EntryBody) }), "The entries"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const createEntry = createRoute({
  method: "post",
  path: "/calendar",
  tags,
  security,
  summary: "Add a calendar entry",
  description:
    "`householdId` creates the entry for a household, so every member sees it; without it the " +
    "entry is personal. You may choose the `id`. Sending an id that already exists returns " +
    "that entry and changes nothing.",
  request: { body: body(InputBody) },
  responses: {
    201: json(z.object({ entry: EntryBody }), "Added, or already there"),
    400: error("Invalid entry"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's entry"),
    ...signedIn,
  },
})

const updateEntry = createRoute({
  method: "patch",
  path: "/calendar/{entryId}",
  tags,
  security,
  summary: "Change a calendar entry",
  description:
    "Everyone who can see the entry can change its title, colour or day. A household entry " +
    "stays in its household.",
  request: { params: entryId, body: body(UpdateBody) },
  responses: {
    200: json(z.object({ entry: EntryBody }), "The changed entry"),
    400: error("Invalid change"),
    404: notFound,
    ...signedIn,
  },
})

const deleteEntry = createRoute({
  method: "delete",
  path: "/calendar/{entryId}",
  tags,
  security,
  summary: "Delete a calendar entry",
  description: "Everyone who can see the entry can delete it.",
  request: { params: entryId },
  responses: {
    204: { description: "Deleted" },
    404: notFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }

const toEntry = (row: CalendarEntryRow): CalendarEntry => ({
  id: row.id,
  title: row.title,
  color: row.color,
  date: row.date,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

/** Calendar endpoints. Mounted under /api. */
export function calendarRoutes(db: Database, auth: Auth) {
  const store = calendarStore(db)

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

  for (const path of ["/calendar", "/calendar/*"]) {
    app.use(path, requireSession(auth))
  }

  app.openapi(listEntries, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await store.forSpace(userId, householdId)
      : await store.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ entries: rows.map(toEntry) }, 200)
  })

  app.openapi(createEntry, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await store.create(userId, input)
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ entry: toEntry(result.row) }, 201)
  })

  app.openapi(updateEntry, async (c) => {
    const { entryId } = c.req.valid("param")
    if (!(await store.access(entryId, c.get("user").id))) {
      return c.json({ error: "Calendar entry not found" }, 404)
    }
    const row = await store.update(entryId, c.req.valid("json"))
    if (!row) return c.json({ error: "Calendar entry not found" }, 404)
    return c.json({ entry: toEntry(row) }, 200)
  })

  app.openapi(deleteEntry, async (c) => {
    const { entryId } = c.req.valid("param")
    if (
      !(await store.access(entryId, c.get("user").id)) ||
      !(await store.remove(entryId))
    ) {
      return c.json({ error: "Calendar entry not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
