import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import { schema, type Database } from "@workspace/database"
import {
  NoteInputSchema,
  NoteSchema,
  NoteUpdateSchema,
  type Note,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { spaceStore } from "../space-store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Note not found" }) })
  .openapi("Error")

const Body = NoteSchema.openapi("Note")
const InputBody = NoteInputSchema.openapi("NoteInput")
const UpdateBody = NoteUpdateSchema.openapi("NoteUpdate")

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
const tags = ["Notes"]
const security = [{ cookieAuth: [] }]
const notFound = error("The note doesn't exist, or you can't see it")

const idParam = z.object({
  noteId: z.string().openapi({ param: { name: "noteId", in: "path" } }),
})

const list = createRoute({
  method: "get",
  path: "/notes",
  tags,
  security,
  summary: "List notes",
  description:
    "Your own notes and the notes of your households. With `householdId`, only the " +
    "notes of that household.",
  request: { query: z.object({ householdId: z.string().optional() }) },
  responses: {
    200: json(z.object({ notes: z.array(Body) }), "The notes"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const create = createRoute({
  method: "post",
  path: "/notes",
  tags,
  security,
  summary: "Add a note",
  description:
    "`householdId` shares the note with a household; without it the note is personal. " +
    "You may choose the `id`. Sending an id that already exists returns that note and " +
    "changes nothing.",
  request: { body: body(InputBody) },
  responses: {
    201: json(z.object({ note: Body }), "Added, or already there"),
    400: error("Invalid note"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's note"),
    ...signedIn,
  },
})

const update = createRoute({
  method: "patch",
  path: "/notes/{noteId}",
  tags,
  security,
  summary: "Change a note",
  description: "Everyone who can see the note can change it.",
  request: { params: idParam, body: body(UpdateBody) },
  responses: {
    200: json(z.object({ note: Body }), "The changed note"),
    400: error("Invalid change"),
    404: notFound,
    ...signedIn,
  },
})

const remove = createRoute({
  method: "delete",
  path: "/notes/{noteId}",
  tags,
  security,
  summary: "Delete a note",
  description: "Everyone who can see the note can delete it.",
  request: { params: idParam },
  responses: {
    204: { description: "Deleted" },
    404: notFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }
type Row = typeof schema.note.$inferSelect

const toNote = (row: Row): Note => ({
  id: row.id,
  title: row.title,
  body: row.body,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

/** Notes endpoints. Mounted under /api. */
export function noteRoutes(db: Database, auth: Auth) {
  const store = spaceStore(db, schema.note)

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

  for (const path of ["/notes", "/notes/*"]) {
    app.use(path, requireSession(auth))
  }

  app.openapi(list, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await store.forSpace(userId, householdId)
      : await store.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ notes: rows.map(toNote) }, 200)
  })

  app.openapi(create, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await store.create(userId, input, {
      title: input.title ?? "",
      body: input.body ?? "",
    })
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ note: toNote(result.row) }, 201)
  })

  app.openapi(update, async (c) => {
    const { noteId } = c.req.valid("param")
    if (!(await store.access(noteId, c.get("user").id))) {
      return c.json({ error: "Note not found" }, 404)
    }
    const row = await store.update(noteId, c.req.valid("json"))
    if (!row) return c.json({ error: "Note not found" }, 404)
    return c.json({ note: toNote(row) }, 200)
  })

  app.openapi(remove, async (c) => {
    const { noteId } = c.req.valid("param")
    if (
      !(await store.access(noteId, c.get("user").id)) ||
      !(await store.remove(noteId))
    ) {
      return c.json({ error: "Note not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
