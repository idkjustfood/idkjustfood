import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { Context } from "hono"

import type { Database } from "@workspace/database"
import {
  manualSource,
  RecipeInputSchema,
  RecipeSchema,
  type Recipe,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { householdStore, hasRole } from "../households/store.js"
import { requireSession, type AuthVariables } from "../session.js"
import { recipeStore, type RecipeRow } from "./store.js"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Recipe not found" }) })
  .openapi("Error")

const RecipeBody = RecipeSchema.openapi("Recipe")
const RecipeInputBody = RecipeInputSchema.openapi("RecipeInput")

const RecipeParams = z.object({
  recipeId: z.string().openapi({ param: { name: "recipeId", in: "path" } }),
})

const ListQuery = z.object({
  householdId: z.string().optional().openapi({
    description:
      "List the recipes shared with this household. Without it, you get your own recipes.",
  }),
  q: z.string().max(200).optional().openapi({
    description: "Words to look for in the title and in ingredient names",
    example: "lentil",
  }),
  tags: z.string().max(1500).optional().openapi({
    description: "Only recipes with all of these tags. Separate tags with commas.",
    example: "Italian,Vegetarian",
  }),
})

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})
const error = (description: string) => json(ErrorSchema, description)

const signedIn = { 401: error("Not signed in") }
const tags = ["Recipes"]
const security = [{ cookieAuth: [] }]

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const listRecipes = createRoute({
  method: "get",
  path: "/recipes",
  tags,
  security,
  summary: "List your recipes, or the recipes of a household",
  description:
    "Newest first. Search matches the title and the names of ingredients; " +
    "tag filters need every tag to match.",
  request: { query: ListQuery },
  responses: {
    200: json(z.object({ recipes: z.array(RecipeBody) }), "Recipes"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const createRecipe = createRoute({
  method: "post",
  path: "/recipes",
  tags,
  security,
  summary: "Add a recipe",
  description:
    "An ingredient's quantity is null when the amount is unknown. It is stored as given, never filled in.",
  request: {
    body: { content: { "application/json": { schema: RecipeInputBody } }, required: true },
  },
  responses: {
    201: json(z.object({ recipe: RecipeBody }), "Created"),
    400: error("Invalid recipe"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const getRecipe = createRoute({
  method: "get",
  path: "/recipes/{recipeId}",
  tags,
  security,
  summary: "Get a recipe",
  request: { params: RecipeParams },
  responses: {
    200: json(z.object({ recipe: RecipeBody }), "Recipe"),
    404: error("The recipe doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

const updateRecipe = createRoute({
  method: "put",
  path: "/recipes/{recipeId}",
  tags,
  security,
  summary: "Replace a recipe",
  description:
    "Send the whole recipe. Members of a household can edit its recipes. " +
    "Only the author can move a recipe between 'only me' and a household " +
    "(send `householdId`; leave it out to keep the current place).",
  request: {
    params: RecipeParams,
    body: { content: { "application/json": { schema: RecipeInputBody } }, required: true },
  },
  responses: {
    200: json(z.object({ recipe: RecipeBody }), "Updated"),
    400: error("Invalid recipe"),
    403: error("Only the author can change who the recipe is shared with"),
    404: error("The recipe or household doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

const deleteRecipe = createRoute({
  method: "delete",
  path: "/recipes/{recipeId}",
  tags,
  security,
  summary: "Delete a recipe",
  description:
    "The author can delete it. For a household recipe, the household's owners can too.",
  request: { params: RecipeParams },
  responses: {
    204: { description: "Deleted" },
    403: error("Only the author or a household owner can delete it"),
    404: error("The recipe doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type Env = { Variables: AuthVariables }

export function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    householdId: row.organizationId,
    userId: row.userId,
    title: row.title,
    description: row.description,
    servings: row.servings,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    tags: row.tags,
    ingredients: row.ingredients,
    steps: row.steps,
    nutrition: row.nutrition,
    source: row.source as Recipe["source"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Recipe endpoints. Mounted under /api. */
export function recipeRoutes(db: Database, auth: Auth) {
  const store = recipeStore(db)
  const households = householdStore(db)

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

  for (const path of ["/recipes", "/recipes/*"]) {
    app.use(path, requireSession(auth))
  }

  const notFound = (c: Context<Env>) =>
    c.json({ error: "Recipe not found" }, 404)

  /** True when the user is in the household. Used before putting recipes there. */
  async function inHousehold(userId: string, householdId: string) {
    return !!(await households.membership(householdId, userId))
  }

  app.openapi(listRecipes, async (c) => {
    const user = c.get("user")
    const { householdId, q, tags: tagText } = c.req.valid("query")
    if (householdId && !(await inHousehold(user.id, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const tagList = tagText
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    const rows = await store.list(user.id, householdId ?? null, {
      q,
      tags: tagList,
    })
    return c.json({ recipes: rows.map(toRecipe) }, 200)
  })

  app.openapi(createRecipe, async (c) => {
    const user = c.get("user")
    const { householdId, source, ...content } = c.req.valid("json")
    if (householdId && !(await inHousehold(user.id, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const row = await store.create(user.id, householdId ?? null, {
      ...content,
      source: source ?? manualSource,
    })
    return c.json({ recipe: toRecipe(row) }, 201)
  })

  app.openapi(getRecipe, async (c) => {
    const found = await store.access(c.req.valid("param").recipeId, c.get("user").id)
    if (!found) return notFound(c)
    return c.json({ recipe: toRecipe(found.row) }, 200)
  })

  app.openapi(updateRecipe, async (c) => {
    const user = c.get("user")
    const found = await store.access(c.req.valid("param").recipeId, user.id)
    if (!found) return notFound(c)

    const { householdId, source, ...content } = c.req.valid("json")
    const isAuthor = found.row.userId === user.id
    const moving =
      householdId !== undefined && householdId !== found.row.organizationId
    if (moving) {
      if (!isAuthor) {
        return c.json(
          { error: "Only the author can change who the recipe is shared with" },
          403
        )
      }
      if (householdId && !(await inHousehold(user.id, householdId))) {
        return c.json({ error: "Household not found" }, 404)
      }
    }
    const row = await store.update(
      found.row.id,
      { ...content, source: source ?? (found.row.source as Recipe["source"]) },
      moving ? householdId : undefined
    )
    if (!row) return notFound(c)
    return c.json({ recipe: toRecipe(row) }, 200)
  })

  app.openapi(deleteRecipe, async (c) => {
    const user = c.get("user")
    const found = await store.access(c.req.valid("param").recipeId, user.id)
    if (!found) return notFound(c)
    const allowed =
      found.row.userId === user.id ||
      (found.householdRole !== null && hasRole(found.householdRole, "owner"))
    if (!allowed) {
      return c.json(
        { error: "Only the author or a household owner can delete it" },
        403
      )
    }
    await store.remove(found.row.id)
    return c.body(null, 204)
  })

  return app
}
