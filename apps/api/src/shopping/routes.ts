import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { Context } from "hono"

import type { Database } from "@workspace/database"
import {
  addIngredients,
  AddRecipeToListSchema,
  splitStaples,
  ShoppingItemInputSchema,
  ShoppingItemSchema,
  ShoppingItemUpdateSchema,
  ShoppingListInputSchema,
  ShoppingListRenameSchema,
  ShoppingListSchema,
  type ShoppingItem,
  type ShoppingList,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { householdStore, hasRole } from "../households/store.js"
import { pantryStore } from "../pantry/store.js"
import { recipeStore } from "../recipes/store.js"
import { requireSession, type AuthVariables } from "../session.js"
import {
  shoppingStore,
  type ShoppingItemRow,
  type ShoppingListRow,
} from "./store.js"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Shopping list not found" }) })
  .openapi("Error")

const ListBody = ShoppingListSchema.openapi("ShoppingList")
const ItemBody = ShoppingItemSchema.openapi("ShoppingItem")
const ListInputBody = ShoppingListInputSchema.openapi("ShoppingListInput")
const RenameBody = ShoppingListRenameSchema.openapi("ShoppingListRename")
const ItemInputBody = ShoppingItemInputSchema.openapi("ShoppingItemInput")
const ItemUpdateBody = ShoppingItemUpdateSchema.openapi("ShoppingItemUpdate")
const AddRecipeBody = AddRecipeToListSchema.openapi("AddRecipeToList")

const ListParams = z.object({
  listId: z.string().openapi({ param: { name: "listId", in: "path" } }),
})
const ItemParams = ListParams.extend({
  itemId: z.string().openapi({ param: { name: "itemId", in: "path" } }),
})

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
const tags = ["Shopping lists"]
const security = [{ cookieAuth: [] }]
const noList = error("The list doesn't exist, or you can't see it")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const listLists = createRoute({
  method: "get",
  path: "/shopping-lists",
  tags,
  security,
  summary: "List your shopping lists",
  description:
    "Your personal lists and the lists of every household you are in, with their items. " +
    "A list with a `householdId` is shared with that household; one without is only yours.",
  responses: {
    200: json(z.object({ lists: z.array(ListBody) }), "Lists, oldest first"),
    ...signedIn,
  },
})

const createList = createRoute({
  method: "post",
  path: "/shopping-lists",
  tags,
  security,
  summary: "Make a shopping list",
  description:
    "Send `householdId` to share the list with a household you are in; leave it out for a personal list. " +
    "You may choose the `id` yourself (a UUID): sending the same id again returns the existing list, " +
    "which makes a retry after a lost connection safe.",
  request: { body: body(ListInputBody) },
  responses: {
    201: json(z.object({ list: ListBody }), "Created"),
    400: error("Invalid list"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by another list"),
    ...signedIn,
  },
})

const getList = createRoute({
  method: "get",
  path: "/shopping-lists/{listId}",
  tags,
  security,
  summary: "Get a shopping list",
  request: { params: ListParams },
  responses: {
    200: json(z.object({ list: ListBody }), "The list"),
    404: noList,
    ...signedIn,
  },
})

const renameList = createRoute({
  method: "patch",
  path: "/shopping-lists/{listId}",
  tags,
  security,
  summary: "Rename a shopping list",
  description: "Everyone who can see the list can rename it.",
  request: { params: ListParams, body: body(RenameBody) },
  responses: {
    200: json(z.object({ list: ListBody }), "Renamed"),
    400: error("Invalid name"),
    404: noList,
    ...signedIn,
  },
})

const deleteList = createRoute({
  method: "delete",
  path: "/shopping-lists/{listId}",
  tags,
  security,
  summary: "Delete a shopping list",
  description:
    "The person who made the list can delete it. For a household list, the household's owners can too.",
  request: { params: ListParams },
  responses: {
    204: { description: "Deleted" },
    403: error(
      "Only the person who made the list or a household owner can delete it"
    ),
    404: noList,
    ...signedIn,
  },
})

const addItem = createRoute({
  method: "post",
  path: "/shopping-lists/{listId}/items",
  tags,
  security,
  summary: "Add an item to a list",
  description:
    "Adds one line as written. `quantity` stays null when you don't give an amount. " +
    "You may choose the item's `id`; sending the same id again changes nothing.",
  request: { params: ListParams, body: body(ItemInputBody) },
  responses: {
    201: json(z.object({ item: ItemBody }), "Added"),
    400: error("Invalid item"),
    404: noList,
    409: error("That id is already used by another item"),
    ...signedIn,
  },
})

const updateItem = createRoute({
  method: "patch",
  path: "/shopping-lists/{listId}/items/{itemId}",
  tags,
  security,
  summary: "Change or tick off an item",
  description:
    "Only the fields you send change. Send `checked` to tick an item on or off.",
  request: { params: ItemParams, body: body(ItemUpdateBody) },
  responses: {
    200: json(z.object({ item: ItemBody }), "Updated"),
    400: error("Invalid change"),
    404: error("The list or the item doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

const removeItem = createRoute({
  method: "delete",
  path: "/shopping-lists/{listId}/items/{itemId}",
  tags,
  security,
  summary: "Remove an item",
  request: { params: ItemParams },
  responses: {
    204: { description: "Removed" },
    404: error("The list or the item doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

const clearChecked = createRoute({
  method: "delete",
  path: "/shopping-lists/{listId}/items",
  tags,
  security,
  summary: "Remove all ticked-off items",
  request: { params: ListParams },
  responses: {
    200: json(
      z.object({ list: ListBody }),
      "The list without the ticked-off items"
    ),
    404: noList,
    ...signedIn,
  },
})

const addRecipe = createRoute({
  method: "post",
  path: "/shopping-lists/{listId}/recipes",
  tags,
  security,
  summary: "Add a recipe's ingredients to a list",
  description:
    "Scales the amounts to `servings` (the recipe's own servings by default) and merges identical " +
    "ingredients: the same name with the same unit adds up (200 g + 100 g flour is 300 g). " +
    "Different units stay on separate lines, and an ingredient without an amount is added " +
    "without one. Ingredients on the pantry list of the list's space (your own, or the household's) " +
    "are left out and returned in `skipped`. You need to be able to see the recipe.",
  request: { params: ListParams, body: body(AddRecipeBody) },
  responses: {
    200: json(
      z.object({
        list: ListBody,
        skipped: z.array(z.string()).openapi({
          description:
            "Names of the ingredients that were left out because they are on the pantry list",
          example: ["Salt"],
        }),
      }),
      "The list with the ingredients added"
    ),
    400: error("Invalid request"),
    404: error("The list or the recipe doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type Env = { Variables: AuthVariables }

export function toItem(row: ShoppingItemRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    checked: row.checked,
    fromRecipes: row.fromRecipes,
  }
}

export function toList(
  row: ShoppingListRow,
  items: ShoppingItemRow[]
): ShoppingList {
  return {
    id: row.id,
    name: row.name,
    householdId: row.organizationId,
    userId: row.userId,
    items: items.map(toItem),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Shopping list endpoints. Mounted under /api. */
export function shoppingRoutes(db: Database, auth: Auth) {
  const store = shoppingStore(db)
  const recipes = recipeStore(db)
  const households = householdStore(db)
  const pantry = pantryStore(db)

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

  for (const path of ["/shopping-lists", "/shopping-lists/*"]) {
    app.use(path, requireSession(auth))
  }

  const notFound = (c: Context<Env>) =>
    c.json({ error: "Shopping list not found" }, 404)

  async function whole(listId: string, row: ShoppingListRow) {
    return toList(row, await store.items(listId))
  }

  app.openapi(listLists, async (c) => {
    const rows = await store.listForUser(c.get("user").id)
    return c.json(
      { lists: rows.map(({ row, items }) => toList(row, items)) },
      200
    )
  })

  app.openapi(createList, async (c) => {
    const user = c.get("user")
    const { id, name, householdId } = c.req.valid("json")
    if (householdId && !(await households.membership(householdId, user.id))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const row = await store.create(user.id, householdId ?? null, name, id)
    if (!row) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ list: await whole(row.id, row) }, 201)
  })

  app.openapi(getList, async (c) => {
    const found = await store.access(
      c.req.valid("param").listId,
      c.get("user").id
    )
    if (!found) return notFound(c)
    return c.json({ list: await whole(found.row.id, found.row) }, 200)
  })

  app.openapi(renameList, async (c) => {
    const found = await store.access(
      c.req.valid("param").listId,
      c.get("user").id
    )
    if (!found) return notFound(c)
    const row = await store.rename(found.row.id, c.req.valid("json").name)
    if (!row) return notFound(c)
    return c.json({ list: await whole(row.id, row) }, 200)
  })

  app.openapi(deleteList, async (c) => {
    const user = c.get("user")
    const found = await store.access(c.req.valid("param").listId, user.id)
    if (!found) return notFound(c)
    const allowed =
      found.row.userId === user.id ||
      (found.householdRole !== null && hasRole(found.householdRole, "owner"))
    if (!allowed) {
      return c.json(
        {
          error:
            "Only the person who made the list or a household owner can delete it",
        },
        403
      )
    }
    await store.remove(found.row.id)
    return c.body(null, 204)
  })

  app.openapi(addItem, async (c) => {
    const found = await store.access(
      c.req.valid("param").listId,
      c.get("user").id
    )
    if (!found) return notFound(c)
    const row = await store.addItem(found.row.id, c.req.valid("json"))
    if (!row) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ item: toItem(row) }, 201)
  })

  app.openapi(updateItem, async (c) => {
    const { listId, itemId } = c.req.valid("param")
    const found = await store.access(listId, c.get("user").id)
    if (!found) return notFound(c)
    const row = await store.updateItem(
      found.row.id,
      itemId,
      c.req.valid("json")
    )
    if (!row) return c.json({ error: "Item not found" }, 404)
    return c.json({ item: toItem(row) }, 200)
  })

  app.openapi(removeItem, async (c) => {
    const { listId, itemId } = c.req.valid("param")
    const found = await store.access(listId, c.get("user").id)
    if (!found) return notFound(c)
    if (!(await store.removeItem(found.row.id, itemId))) {
      return c.json({ error: "Item not found" }, 404)
    }
    return c.body(null, 204)
  })

  app.openapi(clearChecked, async (c) => {
    const found = await store.access(
      c.req.valid("param").listId,
      c.get("user").id
    )
    if (!found) return notFound(c)
    await store.clearChecked(found.row.id)
    return c.json({ list: await whole(found.row.id, found.row) }, 200)
  })

  app.openapi(addRecipe, async (c) => {
    const user = c.get("user")
    const found = await store.access(c.req.valid("param").listId, user.id)
    if (!found) return notFound(c)
    const { recipeId, servings, language } = c.req.valid("json")
    const recipe = await recipes.access(recipeId, user.id)
    if (!recipe) return c.json({ error: "Recipe not found" }, 404)

    const factor = servings ? servings / recipe.row.servings : 1
    // Ingredients the space always has at home are not added.
    const space = await pantry.access(
      user.id,
      found.row.organizationId,
      language
    )
    const staples = space ? await pantry.items(space.id) : []
    const { needed, skipped } = splitStaples(
      recipe.row.ingredients,
      staples.map((item) => item.name)
    )
    await store.saveMerged(found.row.id, (current) =>
      addIngredients(current, needed, recipe.row.title, factor)
    )
    return c.json(
      {
        list: await whole(found.row.id, found.row),
        skipped: skipped.map((ingredient) => ingredient.name),
      },
      200
    )
  })

  return app
}
