import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { schema, type Database } from "@workspace/database"
import {
  WishInputSchema,
  WishPersonInputSchema,
  WishPersonSchema,
  WishPersonUpdateSchema,
  WishSchema,
  WishUpdateSchema,
  type Wish,
  type WishPerson,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { spaceStore } from "../space-store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Wish not found" }) })
  .openapi("Error")

const PersonBody = WishPersonSchema.openapi("WishPerson")
const PersonInput = WishPersonInputSchema.openapi("WishPersonInput")
const PersonUpdate = WishPersonUpdateSchema.openapi("WishPersonUpdate")
const WishBody = WishSchema.openapi("Wish")
const WishInput = WishInputSchema.openapi("WishInput")
const WishUpdate = WishUpdateSchema.openapi("WishUpdate")

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
const tags = ["Wishlists"]
const security = [{ cookieAuth: [] }]
const query = z.object({ householdId: z.string().optional() })

const personParam = z.object({
  personId: z.string().openapi({ param: { name: "personId", in: "path" } }),
})
const wishParam = z.object({
  wishId: z.string().openapi({ param: { name: "wishId", in: "path" } }),
})

const listPeople = createRoute({
  method: "get",
  path: "/wish-people",
  tags,
  security,
  summary: "List the people wishlists are kept for",
  description:
    "Your own people and the people of your households. With `householdId`, only that household.",
  request: { query },
  responses: {
    200: json(z.object({ people: z.array(PersonBody) }), "The people"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const createPerson = createRoute({
  method: "post",
  path: "/wish-people",
  tags,
  security,
  summary: "Add a person to keep a wishlist for",
  description:
    "`householdId` shares the person with a household. You may choose the `id`; sending one " +
    "that already exists returns that person and changes nothing.",
  request: { body: body(PersonInput) },
  responses: {
    201: json(z.object({ person: PersonBody }), "Added, or already there"),
    400: error("Invalid person"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's person"),
    ...signedIn,
  },
})

const personNotFound = error("The person doesn't exist, or you can't see them")

const updatePerson = createRoute({
  method: "patch",
  path: "/wish-people/{personId}",
  tags,
  security,
  summary: "Rename a person",
  request: { params: personParam, body: body(PersonUpdate) },
  responses: {
    200: json(z.object({ person: PersonBody }), "The changed person"),
    400: error("Invalid change"),
    404: personNotFound,
    ...signedIn,
  },
})

const removePerson = createRoute({
  method: "delete",
  path: "/wish-people/{personId}",
  tags,
  security,
  summary: "Delete a person",
  description: "Also deletes every wish of that person.",
  request: { params: personParam },
  responses: {
    204: { description: "Deleted" },
    404: personNotFound,
    ...signedIn,
  },
})

const listWishes = createRoute({
  method: "get",
  path: "/wishes",
  tags,
  security,
  summary: "List wishes",
  description:
    "Your own wishes and the wishes of your households. With `householdId`, only that household.",
  request: { query },
  responses: {
    200: json(z.object({ wishes: z.array(WishBody) }), "The wishes"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const createWish = createRoute({
  method: "post",
  path: "/wishes",
  tags,
  security,
  summary: "Add a wish",
  description:
    "`personId` puts the wish under a person; without it the wish sits at the root. The person " +
    "must belong to the same space (personal or the same household). You may choose the `id`.",
  request: { body: body(WishInput) },
  responses: {
    201: json(z.object({ wish: WishBody }), "Added, or already there"),
    400: error("Invalid wish"),
    404: error("Household or person not found"),
    409: error("That id is already used by someone else's wish"),
    ...signedIn,
  },
})

const wishNotFound = error("The wish doesn't exist, or you can't see it")

const updateWish = createRoute({
  method: "patch",
  path: "/wishes/{wishId}",
  tags,
  security,
  summary: "Change a wish",
  description: "`personId` moves the wish to a person; null moves it to the root.",
  request: { params: wishParam, body: body(WishUpdate) },
  responses: {
    200: json(z.object({ wish: WishBody }), "The changed wish"),
    400: error("Invalid change"),
    404: error("The wish or the person doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

const removeWish = createRoute({
  method: "delete",
  path: "/wishes/{wishId}",
  tags,
  security,
  summary: "Delete a wish",
  request: { params: wishParam },
  responses: {
    204: { description: "Deleted" },
    404: wishNotFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }

const toPerson = (row: typeof schema.wishPerson.$inferSelect): WishPerson => ({
  id: row.id,
  name: row.name,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

const toWish = (row: typeof schema.wish.$inferSelect): Wish => ({
  id: row.id,
  title: row.title,
  note: row.note,
  link: row.link,
  done: row.done,
  personId: row.personId,
  householdId: row.organizationId,
  createdAt: row.createdAt.toISOString(),
})

/** Wishlist endpoints (people and wishes). Mounted under /api. */
export function wishlistRoutes(db: Database, auth: Auth) {
  const people = spaceStore(db, schema.wishPerson)
  const wishes = spaceStore(db, schema.wish)

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

  for (const path of ["/wish-people", "/wish-people/*", "/wishes", "/wishes/*"]) {
    app.use(path, requireSession(auth))
  }

  /** Whether a person can hold wishes of this space: it exists, is visible and is in the same space. */
  async function personFits(
    userId: string,
    personId: string,
    householdId: string | null
  ) {
    const person = await people.access(personId, userId)
    return !!person && (person.organizationId as string | null) === householdId
  }

  app.openapi(listPeople, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await people.forSpace(userId, householdId)
      : await people.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ people: rows.map(toPerson) }, 200)
  })

  app.openapi(createPerson, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    if (!(await people.mayUse(userId, input.householdId ?? null))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const result = await people.create(userId, input, { name: input.name })
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ person: toPerson(result.row) }, 201)
  })

  app.openapi(updatePerson, async (c) => {
    const { personId } = c.req.valid("param")
    if (!(await people.access(personId, c.get("user").id))) {
      return c.json({ error: "Person not found" }, 404)
    }
    const row = await people.update(personId, c.req.valid("json"))
    if (!row) return c.json({ error: "Person not found" }, 404)
    return c.json({ person: toPerson(row) }, 200)
  })

  app.openapi(removePerson, async (c) => {
    const { personId } = c.req.valid("param")
    if (
      !(await people.access(personId, c.get("user").id)) ||
      !(await people.remove(personId))
    ) {
      return c.json({ error: "Person not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(listWishes, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await wishes.forSpace(userId, householdId)
      : await wishes.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ wishes: rows.map(toWish) }, 200)
  })

  app.openapi(createWish, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    const householdId = input.householdId ?? null
    if (!(await wishes.mayUse(userId, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    if (input.personId && !(await personFits(userId, input.personId, householdId))) {
      return c.json({ error: "Person not found" }, 404)
    }
    const result = await wishes.create(userId, input, {
      title: input.title,
      note: input.note ?? "",
      link: input.link ?? "",
      done: input.done ?? false,
      personId: input.personId ?? null,
    })
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ wish: toWish(result.row) }, 201)
  })

  app.openapi(updateWish, async (c) => {
    const { wishId } = c.req.valid("param")
    const userId = c.get("user").id
    const existing = await wishes.access(wishId, userId)
    if (!existing) return c.json({ error: "Wish not found" }, 404)
    const change = c.req.valid("json")
    if (
      change.personId &&
      !(await personFits(userId, change.personId, existing.organizationId as string | null))
    ) {
      return c.json({ error: "Person not found" }, 404)
    }
    const row = await wishes.update(wishId, change)
    if (!row) return c.json({ error: "Wish not found" }, 404)
    return c.json({ wish: toWish(row) }, 200)
  })

  app.openapi(removeWish, async (c) => {
    const { wishId } = c.req.valid("param")
    if (
      !(await wishes.access(wishId, c.get("user").id)) ||
      !(await wishes.remove(wishId))
    ) {
      return c.json({ error: "Wish not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
