import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import { schema, type Database } from "@workspace/database"
import {
  ContactInputSchema,
  ContactSchema,
  ContactUpdateSchema,
  type Contact,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { spaceStore } from "../space-store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Contact not found" }) })
  .openapi("Error")

const Body = ContactSchema.openapi("Contact")
const InputBody = ContactInputSchema.openapi("ContactInput")
const UpdateBody = ContactUpdateSchema.openapi("ContactUpdate")

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
const tags = ["Contacts"]
const security = [{ cookieAuth: [] }]
const notFound = error("The contact doesn't exist, or you can't see it")

const idParam = z.object({
  contactId: z.string().openapi({ param: { name: "contactId", in: "path" } }),
})

const list = createRoute({
  method: "get",
  path: "/contacts",
  tags,
  security,
  summary: "List contacts",
  description:
    "Your own contacts and the contacts of your households. With `householdId`, only the " +
    "contacts of that household.",
  request: { query: z.object({ householdId: z.string().optional() }) },
  responses: {
    200: json(z.object({ contacts: z.array(Body) }), "The contacts"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const create = createRoute({
  method: "post",
  path: "/contacts",
  tags,
  security,
  summary: "Add a contact",
  description:
    "`householdId` shares the contact with a household; without it the contact is personal. " +
    "You may choose the `id`. Sending an id that already exists returns that contact and " +
    "changes nothing.",
  request: { body: body(InputBody) },
  responses: {
    201: json(z.object({ contact: Body }), "Added, or already there"),
    400: error("Invalid contact"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's contact"),
    ...signedIn,
  },
})

const update = createRoute({
  method: "patch",
  path: "/contacts/{contactId}",
  tags,
  security,
  summary: "Change a contact",
  description: "Everyone who can see the contact can change it.",
  request: { params: idParam, body: body(UpdateBody) },
  responses: {
    200: json(z.object({ contact: Body }), "The changed contact"),
    400: error("Invalid change"),
    404: notFound,
    ...signedIn,
  },
})

const remove = createRoute({
  method: "delete",
  path: "/contacts/{contactId}",
  tags,
  security,
  summary: "Delete a contact",
  description: "Everyone who can see the contact can delete it.",
  request: { params: idParam },
  responses: {
    204: { description: "Deleted" },
    404: notFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }
type Row = typeof schema.contact.$inferSelect

const toContact = (row: Row): Contact => ({
  id: row.id,
  name: row.name,
  role: row.role,
  phone: row.phone,
  email: row.email,
  note: row.note,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

/** Contacts endpoints. Mounted under /api. */
export function contactRoutes(db: Database, auth: Auth) {
  const store = spaceStore(db, schema.contact)

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

  for (const path of ["/contacts", "/contacts/*"]) {
    app.use(path, requireSession(auth))
  }

  app.openapi(list, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await store.forSpace(userId, householdId)
      : await store.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ contacts: rows.map(toContact) }, 200)
  })

  app.openapi(create, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await store.create(userId, input, {
      name: input.name,
      role: input.role ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      note: input.note ?? "",
    })
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ contact: toContact(result.row) }, 201)
  })

  app.openapi(update, async (c) => {
    const { contactId } = c.req.valid("param")
    if (!(await store.access(contactId, c.get("user").id))) {
      return c.json({ error: "Contact not found" }, 404)
    }
    const row = await store.update(contactId, c.req.valid("json"))
    if (!row) return c.json({ error: "Contact not found" }, 404)
    return c.json({ contact: toContact(row) }, 200)
  })

  app.openapi(remove, async (c) => {
    const { contactId } = c.req.valid("param")
    if (
      !(await store.access(contactId, c.get("user").id)) ||
      !(await store.remove(contactId))
    ) {
      return c.json({ error: "Contact not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
