import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { Context } from "hono"

import type { Database } from "@workspace/database"
import {
  addIngredients,
  autoPlan,
  DateSchema,
  GeneratePlanSchema,
  GenerateResultSchema,
  MealPlanInputSchema,
  MealPlanRenameSchema,
  MealPlanSchema,
  MealServingsSchema,
  MealSlotSchema,
  mealSlots,
  PlanToListSchema,
  SetMealSchema,
  type Meal,
  type MealPlan,
  type PlannableRecipe,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { householdStore, hasRole } from "../households/store.js"
import { recipeStore } from "../recipes/store.js"
import { requireSession, type AuthVariables } from "../session.js"
import { shoppingStore } from "../shopping/store.js"
import { plannerStore, type MealPlanRow, type MealWithRecipe } from "./store.js"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Meal plan not found" }) })
  .openapi("Error")

const PlanBody = MealPlanSchema.openapi("MealPlan")
const PlanInputBody = MealPlanInputSchema.openapi("MealPlanInput")
const RenameBody = MealPlanRenameSchema.openapi("MealPlanRename")
const SetMealBody = SetMealSchema.openapi("SetMeal")
const ServingsBody = MealServingsSchema.openapi("MealServings")
const GenerateBody = GeneratePlanSchema.openapi("GeneratePlan")
const GenerateResultBody = GenerateResultSchema.openapi("GeneratePlanResult")
const PlanToListBody = PlanToListSchema.openapi("PlanToList")
const AddedToListBody = z
  .object({ listId: z.string(), added: z.number().int() })
  .openapi("PlanAddedToList")

const PlanParams = z.object({
  planId: z.string().openapi({ param: { name: "planId", in: "path" } }),
})
const SlotParams = PlanParams.extend({
  date: DateSchema.openapi({ param: { name: "date", in: "path" } }),
  slot: MealSlotSchema.openapi({ param: { name: "slot", in: "path" } }),
})
const RangeQuery = z.object({
  from: DateSchema.optional().openapi({
    param: { name: "from", in: "query" },
    description: "Only meals from this day on (YYYY-MM-DD).",
  }),
  to: DateSchema.optional().openapi({
    param: { name: "to", in: "query" },
    description: "Only meals up to and including this day (YYYY-MM-DD).",
  }),
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
const tags = ["Meal plans"]
const security = [{ cookieAuth: [] }]
const noPlan = error("The plan doesn't exist, or you can't see it")

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const listPlans = createRoute({
  method: "get",
  path: "/meal-plans",
  tags,
  security,
  summary: "List your meal plans",
  description:
    "Your personal plans and the plans of every household you are in. The meals are left out; " +
    "get one plan to see them.",
  responses: {
    200: json(z.object({ plans: z.array(PlanBody) }), "Plans, oldest first"),
    ...signedIn,
  },
})

const createPlan = createRoute({
  method: "post",
  path: "/meal-plans",
  tags,
  security,
  summary: "Make a meal plan",
  description:
    "Send `householdId` to share the plan with a household you are in; leave it out for a personal plan. " +
    "A plan has no fixed length: it holds meals for any days, so you can plan weeks ahead.",
  request: { body: body(PlanInputBody) },
  responses: {
    201: json(z.object({ plan: PlanBody }), "Created"),
    400: error("Invalid plan"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by another plan"),
    ...signedIn,
  },
})

const getPlan = createRoute({
  method: "get",
  path: "/meal-plans/{planId}",
  tags,
  security,
  summary: "Get a meal plan with its meals",
  description:
    "Every meal is a recipe in one of three slots of a day: `breakfast`, `midday` or `afternoon`. " +
    "Use `from` and `to` to get only some days. Calories are an estimate per serving.",
  request: { params: PlanParams, query: RangeQuery },
  responses: {
    200: json(z.object({ plan: PlanBody }), "The plan"),
    404: noPlan,
    ...signedIn,
  },
})

const renamePlan = createRoute({
  method: "patch",
  path: "/meal-plans/{planId}",
  tags,
  security,
  summary: "Rename a meal plan",
  description: "Everyone who can see the plan can rename it.",
  request: { params: PlanParams, body: body(RenameBody) },
  responses: {
    200: json(z.object({ plan: PlanBody }), "Renamed"),
    400: error("Invalid name"),
    404: noPlan,
    ...signedIn,
  },
})

const deletePlan = createRoute({
  method: "delete",
  path: "/meal-plans/{planId}",
  tags,
  security,
  summary: "Delete a meal plan",
  description:
    "The person who made the plan can delete it. For a household plan, the household's owners can too.",
  request: { params: PlanParams },
  responses: {
    204: { description: "Deleted" },
    403: error(
      "Only the person who made the plan or a household owner can delete it"
    ),
    404: noPlan,
    ...signedIn,
  },
})

const setMeal = createRoute({
  method: "put",
  path: "/meal-plans/{planId}/meals/{date}/{slot}",
  tags,
  security,
  summary: "Put a recipe in a slot",
  description:
    "Plans or swaps the meal of one slot. A household plan can only use the household's recipes, " +
    "so that every member can open them. A personal plan can use your own recipes and your households'.",
  request: { params: SlotParams, body: body(SetMealBody) },
  responses: {
    200: json(z.object({ plan: PlanBody }), "The plan with the meal set"),
    400: error("Invalid meal"),
    404: error("The plan or the recipe doesn't exist, or you can't use it"),
    ...signedIn,
  },
})

const setServings = createRoute({
  method: "patch",
  path: "/meal-plans/{planId}/meals/{date}/{slot}",
  tags,
  security,
  summary: "Change the servings of a meal",
  request: { params: SlotParams, body: body(ServingsBody) },
  responses: {
    200: json(z.object({ plan: PlanBody }), "The plan with the new servings"),
    400: error("Invalid servings"),
    404: error("The plan doesn't exist, or nothing is planned in that slot"),
    ...signedIn,
  },
})

const removeMeal = createRoute({
  method: "delete",
  path: "/meal-plans/{planId}/meals/{date}/{slot}",
  tags,
  security,
  summary: "Empty a slot",
  request: { params: SlotParams },
  responses: {
    200: json(z.object({ plan: PlanBody }), "The plan without the meal"),
    404: error("The plan doesn't exist, or nothing is planned in that slot"),
    ...signedIn,
  },
})

const generate = createRoute({
  method: "post",
  path: "/meal-plans/{planId}/generate",
  tags,
  security,
  summary: "Fill days automatically from your saved recipes",
  description:
    "Plain code, not AI: the same wishes give the same plan, whichever AI provider (or none) the server uses. " +
    "Wishes: `caloriesPerDay`, `diet` (a tag) and `maxMinutes`. `days` lists the days to fill; a day can be " +
    "skipped (`skip`), have meals skipped (`skipSlots`) or its own `servings`. By default only empty slots " +
    "are filled; `overwrite` replaces planned meals. Recipes that lack the data a wish needs (a calorie " +
    "estimate, a cooking time) are skipped, never guessed. When nothing matches, the slot stays empty and " +
    "is listed in `unfilled`. Calories are estimates.",
  request: { params: PlanParams, body: body(GenerateBody) },
  responses: {
    200: json(GenerateResultBody, "The plan, and the slots that stayed empty"),
    400: error("Invalid request"),
    404: noPlan,
    ...signedIn,
  },
})

const toShoppingList = createRoute({
  method: "post",
  path: "/meal-plans/{planId}/shopping-list",
  tags,
  security,
  summary: "Add the plan's ingredients to a shopping list",
  description:
    "Nothing is added to a list unless you call this. Every meal's ingredients are scaled to its servings " +
    "and merged into the list like a recipe is. Use `from` and `to` to take only some days.",
  request: { params: PlanParams, body: body(PlanToListBody) },
  responses: {
    200: json(AddedToListBody, "The ingredients were added"),
    400: error("Invalid request"),
    404: error("The plan or the list doesn't exist, or you can't see it"),
    ...signedIn,
  },
})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type Env = { Variables: AuthVariables }

export function toMeal({ meal, recipe }: MealWithRecipe): Meal {
  return {
    date: meal.date,
    slot: meal.slot as Meal["slot"],
    servings: meal.servings,
    recipe: {
      id: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      calories: recipe.nutrition.calories,
    },
  }
}

export function toPlan(row: MealPlanRow, meals: MealWithRecipe[]): MealPlan {
  return {
    id: row.id,
    name: row.name,
    householdId: row.organizationId,
    userId: row.userId,
    meals: meals.map(toMeal),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Meal plan endpoints. Mounted under /api. */
export function plannerRoutes(db: Database, auth: Auth) {
  const store = plannerStore(db)
  const recipes = recipeStore(db)
  const shopping = shoppingStore(db)
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

  for (const path of ["/meal-plans", "/meal-plans/*"]) {
    app.use(path, requireSession(auth))
  }

  const notFound = (c: Context<Env>) =>
    c.json({ error: "Meal plan not found" }, 404)

  async function whole(row: MealPlanRow) {
    return toPlan(row, await store.meals(row.id))
  }

  /** Whether the plan may use this recipe: the user sees it, and every member of a household plan will too. */
  async function usable(plan: MealPlanRow, recipeId: string, userId: string) {
    const found = await recipes.access(recipeId, userId)
    if (!found) return undefined
    if (
      plan.organizationId &&
      found.row.organizationId !== plan.organizationId
    ) {
      return undefined
    }
    return found.row
  }

  app.openapi(listPlans, async (c) => {
    const rows = await store.listForUser(c.get("user").id)
    return c.json({ plans: rows.map((row) => toPlan(row, [])) }, 200)
  })

  app.openapi(createPlan, async (c) => {
    const user = c.get("user")
    const { id, name, householdId } = c.req.valid("json")
    if (householdId && !(await households.membership(householdId, user.id))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const row = await store.create(user.id, householdId ?? null, name, id)
    if (!row) return c.json({ error: "That id is already in use" }, 409)
    return c.json({ plan: await whole(row) }, 201)
  })

  app.openapi(getPlan, async (c) => {
    const found = await store.access(
      c.req.valid("param").planId,
      c.get("user").id
    )
    if (!found) return notFound(c)
    const range = c.req.valid("query")
    return c.json(
      { plan: toPlan(found.row, await store.meals(found.row.id, range)) },
      200
    )
  })

  app.openapi(renamePlan, async (c) => {
    const found = await store.access(
      c.req.valid("param").planId,
      c.get("user").id
    )
    if (!found) return notFound(c)
    const row = await store.rename(found.row.id, c.req.valid("json").name)
    if (!row) return notFound(c)
    return c.json({ plan: await whole(row) }, 200)
  })

  app.openapi(deletePlan, async (c) => {
    const user = c.get("user")
    const found = await store.access(c.req.valid("param").planId, user.id)
    if (!found) return notFound(c)
    const allowed =
      found.row.userId === user.id ||
      (found.householdRole !== null && hasRole(found.householdRole, "owner"))
    if (!allowed) {
      return c.json(
        {
          error:
            "Only the person who made the plan or a household owner can delete it",
        },
        403
      )
    }
    await store.remove(found.row.id)
    return c.body(null, 204)
  })

  app.openapi(setMeal, async (c) => {
    const user = c.get("user")
    const { planId, date, slot } = c.req.valid("param")
    const found = await store.access(planId, user.id)
    if (!found) return notFound(c)
    const { recipeId, servings } = c.req.valid("json")
    if (!(await usable(found.row, recipeId, user.id))) {
      return c.json({ error: "Recipe not found" }, 404)
    }
    await store.setMeal(found.row.id, date, slot, recipeId, servings)
    return c.json({ plan: await whole(found.row) }, 200)
  })

  app.openapi(setServings, async (c) => {
    const { planId, date, slot } = c.req.valid("param")
    const found = await store.access(planId, c.get("user").id)
    if (!found) return notFound(c)
    const changed = await store.setServings(
      found.row.id,
      date,
      slot,
      c.req.valid("json").servings
    )
    if (!changed) return c.json({ error: "Nothing is planned there" }, 404)
    return c.json({ plan: await whole(found.row) }, 200)
  })

  app.openapi(removeMeal, async (c) => {
    const { planId, date, slot } = c.req.valid("param")
    const found = await store.access(planId, c.get("user").id)
    if (!found) return notFound(c)
    if (!(await store.removeMeal(found.row.id, date, slot))) {
      return c.json({ error: "Nothing is planned there" }, 404)
    }
    return c.json({ plan: await whole(found.row) }, 200)
  })

  app.openapi(generate, async (c) => {
    const user = c.get("user")
    const found = await store.access(c.req.valid("param").planId, user.id)
    if (!found) return notFound(c)
    const request = c.req.valid("json")

    // A date listed twice counts once.
    const seen = new Set<string>()
    const days = request.days.filter((day) => {
      if (seen.has(day.date)) return false
      seen.add(day.date)
      return true
    })
    const dates = days.map((d) => d.date).sort()

    const plannable: PlannableRecipe[] = (
      await store.usableRecipes(found.row, user.id)
    ).map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      calories: r.nutrition.calories,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
    }))

    const current = await store.meals(found.row.id, {
      from: dates[0],
      to: dates[dates.length - 1],
    })
    const existing = request.overwrite
      ? []
      : current
          .filter(({ meal }) => seen.has(meal.date))
          .map(({ meal, recipe }) => ({
            date: meal.date,
            slot: meal.slot as Meal["slot"],
            recipeId: recipe.id,
            calories: recipe.nutrition.calories,
          }))

    const result = autoPlan({
      recipes: plannable,
      goals: request.goals,
      days,
      servings: request.servings,
      existing,
    })

    // With `overwrite`, every slot the planner works on is emptied first, so a slot that
    // finds no recipe doesn't keep an old meal while the answer says it stayed empty.
    const clear = request.overwrite
      ? days.flatMap((day) =>
          day.skip
            ? []
            : mealSlots
                .filter((slot) => !day.skipSlots?.includes(slot))
                .map((slot) => ({ date: day.date, slot }))
        )
      : []
    await store.applyGenerated(found.row.id, clear, result.meals)

    const notes = [...result.notes]
    if (request.goals.caloriesPerDay) {
      notes.push("Calories are estimates from the recipes' nutrition values.")
    }
    return c.json(
      {
        plan: await whole(found.row),
        unfilled: result.unfilled,
        notes,
      },
      200
    )
  })

  app.openapi(toShoppingList, async (c) => {
    const user = c.get("user")
    const found = await store.access(c.req.valid("param").planId, user.id)
    if (!found) return notFound(c)
    const { listId, from, to } = c.req.valid("json")
    const list = await shopping.access(listId, user.id)
    if (!list) return c.json({ error: "Shopping list not found" }, 404)

    const meals = await store.meals(found.row.id, { from, to })
    if (meals.length > 0) {
      await shopping.saveMerged(list.row.id, (current) =>
        meals.reduce(
          (items: ReturnType<typeof addIngredients>, { meal, recipe }) =>
            addIngredients(
              items,
              recipe.ingredients,
              recipe.title,
              meal.servings / recipe.servings
            ),
          current
        )
      )
    }
    return c.json({ listId: list.row.id, added: meals.length }, 200)
  })

  return app
}
