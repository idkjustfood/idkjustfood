import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import type { Database } from "@workspace/database"
import {
  ChoreInputSchema,
  ChoreKindSchema,
  ChoreSchema,
  ChoreUpdateSchema,
  type Chore,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { choreStore, type ChoreRow } from "./store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Chore not found" }) })
  .openapi("Error")

const ChoreBody = ChoreSchema.openapi("Chore")
const InputBody = ChoreInputSchema.openapi("ChoreInput")
const UpdateBody = ChoreUpdateSchema.openapi("ChoreUpdate")

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
const tags = ["Chores"]
const security = [{ cookieAuth: [] }]
const notFound = error("The chore doesn't exist, or you can't see it")

const choreId = z.object({
  choreId: z.string().openapi({ param: { name: "choreId", in: "path" } }),
})

const listChores = createRoute({
  method: "get",
  path: "/chores",
  tags,
  security,
  summary: "List chores",
  description:
    "Your own chores and the chores of your households. With `householdId`, only the chores " +
    "of that household, and `kind` only tasks of one module (chores, maintenance, plants or " +
    "pets, which all work the same way). Every chore has `lastDoneOn` and `intervalDays`; a chore is due again " +
    "on `lastDoneOn` + `intervalDays` days, from 00:00. The app works that out on the device, " +
    "in the time zone of the person.",
  request: {
    query: z.object({
      householdId: z.string().optional(),
      kind: ChoreKindSchema.optional(),
    }),
  },
  responses: {
    200: json(z.object({ chores: z.array(ChoreBody) }), "The chores"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const createChore = createRoute({
  method: "post",
  path: "/chores",
  tags,
  security,
  summary: "Add a chore",
  description:
    "`householdId` shares the chore with a household; without it the chore is personal. You may " +
    "choose the `id`. Sending an id that already exists returns that chore and changes nothing. " +
    "A new chore is due right away.",
  request: { body: body(InputBody) },
  responses: {
    201: json(z.object({ chore: ChoreBody }), "Added, or already there"),
    400: error("Invalid chore"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's chore"),
    ...signedIn,
  },
})

const updateChore = createRoute({
  method: "patch",
  path: "/chores/{choreId}",
  tags,
  security,
  summary: "Change a chore, check it off or undo a check",
  description:
    "Everyone who can see the chore can change it. To check a chore off, send `lastDoneOn` with " +
    "the day it was done (`YYYY-MM-DD`, the person's local date). To undo it, send the earlier " +
    "day, or `null` when it was never done.",
  request: { params: choreId, body: body(UpdateBody) },
  responses: {
    200: json(z.object({ chore: ChoreBody }), "The changed chore"),
    400: error("Invalid change"),
    404: notFound,
    ...signedIn,
  },
})

const deleteChore = createRoute({
  method: "delete",
  path: "/chores/{choreId}",
  tags,
  security,
  summary: "Delete a chore",
  description: "Everyone who can see the chore can delete it.",
  request: { params: choreId },
  responses: {
    204: { description: "Deleted" },
    404: notFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }

const toChore = (row: ChoreRow): Chore => ({
  id: row.id,
  name: row.name,
  kind: ChoreKindSchema.catch("chore").parse(row.kind),
  intervalDays: row.intervalDays,
  lastDoneOn: row.lastDoneOn,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

/** Chore endpoints. Mounted under /api. */
export function choreRoutes(db: Database, auth: Auth) {
  const store = choreStore(db)

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

  for (const path of ["/chores", "/chores/*"]) {
    app.use(path, requireSession(auth))
  }

  app.openapi(listChores, async (c) => {
    const { householdId, kind } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await store.forSpace(userId, householdId)
      : await store.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    const chores = rows.map(toChore)
    return c.json(
      { chores: kind ? chores.filter((chore) => chore.kind === kind) : chores },
      200
    )
  })

  app.openapi(createChore, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await store.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await store.create(userId, input)
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ chore: toChore(result.row) }, 201)
  })

  app.openapi(updateChore, async (c) => {
    const { choreId } = c.req.valid("param")
    if (!(await store.access(choreId, c.get("user").id))) {
      return c.json({ error: "Chore not found" }, 404)
    }
    const row = await store.update(choreId, c.req.valid("json"))
    if (!row) return c.json({ error: "Chore not found" }, 404)
    return c.json({ chore: toChore(row) }, 200)
  })

  app.openapi(deleteChore, async (c) => {
    const { choreId } = c.req.valid("param")
    if (
      !(await store.access(choreId, c.get("user").id)) ||
      !(await store.remove(choreId))
    ) {
      return c.json({ error: "Chore not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
