import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"

import type { Database } from "@workspace/database"
import {
  aiConfigured,
  completeRecipe,
  ExtractionError,
  type Ai,
} from "@workspace/extraction"
import {
  IngredientSchema,
  maxCompletionMessage,
  RecipeLanguageSchema,
  StepSchema,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import type { LogVariables } from "../logging.js"
import { requireSession, type AuthVariables } from "../session.js"
import { recipeStore } from "./store.js"

const ErrorSchema = z
  .object({
    error: z.string(),
    code: z.string().optional().openapi({ example: "nothing_to_add" }),
  })
  .openapi("CompleteRecipeError")

const Body = z
  .object({
    message: z.string().trim().min(1).max(maxCompletionMessage).openapi({
      description:
        "What is missing, in the person's own words, for example `add a pizza dough`.",
      example: "add a pizza dough",
    }),
    language: RecipeLanguageSchema.optional().openapi({
      description:
        "Write the new part in this language (`en`, `de`, `es`, `fr` or `it`).",
    }),
  })
  .openapi("CompleteRecipeInput")

const Result = z
  .object({
    ingredients: z.array(IngredientSchema),
    steps: z.array(StepSchema),
    addedIngredients: z.array(z.number().int()).openapi({
      description: "Places in `ingredients` of the ingredients the AI added.",
    }),
    addedSteps: z.array(z.number().int()).openapi({
      description: "Places in `steps` of the steps the AI added.",
    }),
  })
  .openapi("CompletedRecipe")

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})

const complete = createRoute({
  method: "post",
  path: "/recipes/{recipeId}/complete",
  tags: ["Recipes"],
  security: [{ cookieAuth: [] }],
  summary: "Complete a partial recipe with AI",
  description:
    "Takes a free-form message that says what is missing (for example `add a pizza dough`) and " +
    "returns the recipe's ingredients and steps with the AI's additions merged in. The existing " +
    "ingredients and steps stay exactly as they are. Nothing is saved: send the result to " +
    "`PUT /recipes/{recipeId}` once the person has checked it.",
  request: {
    params: z.object({
      recipeId: z.string().openapi({ param: { name: "recipeId", in: "path" } }),
    }),
    body: { content: { "application/json": { schema: Body } }, required: true },
  },
  responses: {
    200: json(Result, "The recipe with the additions, and which ones are new"),
    400: json(ErrorSchema, "Invalid message, or the AI had nothing to add"),
    404: json(ErrorSchema, "The recipe doesn't exist, or you can't see it"),
    401: json(ErrorSchema, "Not signed in"),
    502: json(ErrorSchema, "The AI call failed"),
    503: json(ErrorSchema, "No AI key is set on this server"),
  },
})

type Env = { Variables: AuthVariables & Partial<LogVariables> }

/** Completes a recipe with AI. Mounted under /api. */
export function completeRoutes(
  db: Database,
  auth: Auth,
  env: Record<string, string | undefined>,
  ai: Ai,
  /** Tests pass a fake `ai`, which needs no key. */
  needsKey = true
) {
  const store = recipeStore(db)
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

  app.use("/recipes/:recipeId/complete", requireSession(auth))
  app.use(
    "/recipes/:recipeId/complete",
    bodyLimit({
      maxSize: maxCompletionMessage * 4 + 1024,
      onError: (c) => c.json({ error: "Request too large" }, 400),
    })
  )

  app.openapi(complete, async (c) => {
    const user = c.get("user")
    const { message, language } = c.req.valid("json")
    const found = await store.access(c.req.valid("param").recipeId, user.id)
    if (!found) return c.json({ error: "Recipe not found" }, 404)
    if (needsKey && !aiConfigured(env)) {
      return c.json(
        {
          error:
            "No AI key is set on this server. Ask the admin to set AI_PROVIDER and AI_API_KEY.",
          code: "ai_not_configured",
        },
        503
      )
    }
    try {
      const result = await completeRecipe(
        ai,
        {
          title: found.row.title,
          servings: found.row.servings,
          ingredients: found.row.ingredients,
          steps: found.row.steps,
        },
        message,
        language
      )
      return c.json(result, 200)
    } catch (cause) {
      if (!(cause instanceof ExtractionError)) throw cause
      c.get("log")?.warn("recipe completion failed", { code: cause.code })
      const status =
        cause.code === "ai_not_configured"
          ? 503
          : cause.code === "ai_failed"
            ? 502
            : 400
      return c.json({ error: cause.message, code: cause.code }, status)
    }
  })

  return app
}
