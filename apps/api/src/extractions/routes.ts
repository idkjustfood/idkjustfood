import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"
import type { Context } from "hono"

import type { Database } from "@workspace/database"
import {
  aiConfigured,
  checkImage,
  ExtractionError,
  inputModules,
  jobStore,
  maxImageBytes,
  maxTextLength,
  selectInput,
  type ExtractionInput,
  type InputModule,
  type JobQueue,
  type JobRow,
} from "@workspace/extraction"
import { RecipeSchema } from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { householdStore } from "../households/store.js"
import { toRecipe } from "../recipes/routes.js"
import { recipeStore } from "../recipes/store.js"
import type { LogVariables } from "../logging.js"
import { requireSession, type AuthVariables } from "../session.js"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "That link is not supported." }),
    code: z.string().optional().openapi({
      description:
        "A short code for the problem, for example `unsupported_link`.",
      example: "unsupported_link",
    }),
  })
  .openapi("ExtractionError")

const householdId = z.string().optional().openapi({
  description:
    "Share the new recipe with this household. Without it, the recipe is only yours.",
})

const LinkBody = z
  .object({
    url: z.string().min(1).max(2000).openapi({
      description:
        "A link to an Instagram reel, TikTok, YouTube Short or a recipe website.",
      example: "https://www.instagram.com/reel/Cabc123/",
    }),
    householdId,
  })
  .openapi("ExtractionLinkInput")

const TextBody = z
  .object({
    text: z.string().min(1).max(maxTextLength).openapi({
      description: "A recipe as plain text.",
    }),
    householdId,
  })
  .openapi("ExtractionTextInput")

const ImageBody = z
  .object({
    image: z.file().openapi({
      type: "string",
      format: "binary",
      description: `A photo or screenshot of a recipe: JPEG, PNG, WebP or GIF, up to ${maxImageBytes / 1024 / 1024} MB.`,
    }),
    householdId,
  })
  .openapi("ExtractionImageInput")

const JobSchema = z
  .object({
    id: z.string(),
    status: z.enum(["queued", "running", "succeeded", "failed"]),
    error: z.string().nullable().openapi({
      description: "What went wrong, when the status is `failed`.",
    }),
    errorCode: z.string().nullable(),
    recipe: RecipeSchema.nullable().openapi({
      description: "The new recipe, when the status is `succeeded`.",
    }),
  })
  .openapi("ExtractionJob")

const JobParams = z.object({
  jobId: z.string().openapi({ param: { name: "jobId", in: "path" } }),
})

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})
const error = (description: string) => json(ErrorSchema, description)

const tags = ["Recipe extraction"]
const security = [{ cookieAuth: [] }]
const signedIn = { 401: error("Not signed in") }
const queued = json(
  z.object({ job: JobSchema }),
  "The job was queued. Poll `GET /extractions/{jobId}` for the result."
)

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const startLink = createRoute({
  method: "post",
  path: "/extractions/link",
  tags,
  security,
  summary: "Add a recipe from a video or website link",
  description:
    "Queues a job that reads the link (Instagram Reel, TikTok, YouTube Short or a recipe website) " +
    "and saves the result as a recipe. Websites with recipe data need no AI key.",
  request: {
    body: {
      content: { "application/json": { schema: LinkBody } },
      required: true,
    },
  },
  responses: {
    202: queued,
    400: error(
      "Unsupported or invalid link, or an address on a private network"
    ),
    404: error("Household not found, or you are not a member"),
    503: error("No AI key is set on this server"),
    ...signedIn,
  },
})

const startText = createRoute({
  method: "post",
  path: "/extractions/text",
  tags,
  security,
  summary: "Add a recipe from pasted text",
  request: {
    body: {
      content: { "application/json": { schema: TextBody } },
      required: true,
    },
  },
  responses: {
    202: queued,
    400: error("Empty or too long text"),
    404: error("Household not found, or you are not a member"),
    503: error("No AI key is set on this server"),
    ...signedIn,
  },
})

const startImage = createRoute({
  method: "post",
  path: "/extractions/image",
  tags,
  security,
  summary: "Add a recipe from a photo or screenshot",
  request: {
    body: {
      content: { "multipart/form-data": { schema: ImageBody } },
      required: true,
    },
  },
  responses: {
    202: queued,
    400: error("Not an image, empty, or too large"),
    404: error("Household not found, or you are not a member"),
    503: error("No AI key is set on this server"),
    ...signedIn,
  },
})

const getJob = createRoute({
  method: "get",
  path: "/extractions/{jobId}",
  tags,
  security,
  summary: "Check a job and get its result",
  description:
    "`status` is `queued`, `running`, `succeeded` or `failed`. " +
    "When it succeeded, `recipe` is the saved recipe. When it failed, `error` says why.",
  request: { params: JobParams },
  responses: {
    200: json(z.object({ job: JobSchema }), "The job"),
    404: error("The job doesn't exist, or it is not yours"),
    ...signedIn,
  },
})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type Env = { Variables: AuthVariables & Partial<LogVariables> }

/** A job that never finished (for example the worker was stopped) is reported as failed. */
const staleAfterMs = 30 * 60 * 1000

export type ExtractionDeps = {
  queue: JobQueue
  /** Input modules to use instead of the built-in ones. Tests use this. */
  modules?: InputModule[]
}

/** Recipe extraction endpoints. Mounted under /api. */
export function extractionRoutes(
  db: Database,
  auth: Auth,
  env: Record<string, string | undefined>,
  deps: ExtractionDeps
) {
  const jobs = jobStore(db)
  const recipes = recipeStore(db)
  const households = householdStore(db)
  const modules = deps.modules ?? inputModules

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

  app.use("/extractions/*", requireSession(auth))
  // Stop huge uploads before they are read into memory.
  app.use(
    "/extractions/image",
    bodyLimit({
      maxSize: maxImageBytes + 64 * 1024,
      onError: (c) =>
        c.json(
          {
            error: `The image is too large. The limit is ${maxImageBytes / 1024 / 1024} MB.`,
            code: "invalid_input",
          },
          400
        ),
    })
  )
  app.use(
    "/extractions/link",
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.json({ error: "Request too large" }, 400),
    })
  )
  app.use(
    "/extractions/text",
    bodyLimit({
      maxSize: maxTextLength * 4 + 1024,
      onError: (c) => c.json({ error: "Request too large" }, 400),
    })
  )

  function failure(c: Context<Env>, cause: unknown) {
    if (cause instanceof ExtractionError) {
      return c.json(
        { error: cause.message, code: cause.code },
        cause.code === "ai_not_configured" ? 503 : 400
      )
    }
    throw cause
  }

  /** Validates the input, queues a job and answers 202. */
  async function start(
    c: Context<Env>,
    input: ExtractionInput,
    household: string | undefined
  ) {
    const user = c.get("user")
    try {
      const module = selectInput(input, modules)
      await module.validate?.(input)
      if (module.needsAi && !aiConfigured(env)) {
        throw new ExtractionError(
          "ai_not_configured",
          "No AI key is set on this server. Ask the admin to set AI_PROVIDER and AI_API_KEY."
        )
      }
    } catch (cause) {
      return failure(c, cause)
    }
    if (household && !(await households.membership(household, user.id))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const job = await jobs.create(user.id, household ?? null, input)
    await deps.queue.enqueue(job.id, c.get("requestId"))
    // The request ID in this line is the same one the worker logs for the job.
    c.get("log")?.info("extraction queued", { jobId: job.id, kind: input.type })
    return c.json({ job: await present(job, user.id) }, 202)
  }

  async function present(job: JobRow, userId: string) {
    let { status, error: message, errorCode } = job
    if (
      (status === "queued" || status === "running") &&
      Date.now() - job.updatedAt.getTime() > staleAfterMs
    ) {
      status = "failed"
      message = "The job took too long and was stopped. Try again."
      errorCode = "ai_failed"
    }
    const found =
      status === "succeeded" && job.recipeId
        ? await recipes.access(job.recipeId, userId)
        : undefined
    return {
      id: job.id,
      status: status as "queued" | "running" | "succeeded" | "failed",
      error: message,
      errorCode,
      recipe: found ? toRecipe(found.row) : null,
    }
  }

  app.openapi(startLink, async (c) => {
    const { url, householdId } = c.req.valid("json")
    return start(c, { type: "link", url: url.trim() }, householdId) as never
  })

  app.openapi(startText, async (c) => {
    const { text, householdId } = c.req.valid("json")
    return start(c, { type: "text", text }, householdId) as never
  })

  app.openapi(startImage, async (c) => {
    const { image, householdId } = c.req.valid("form")
    let input: ExtractionInput
    try {
      const data = new Uint8Array(await image.arrayBuffer())
      input = { type: "image", data, mediaType: checkImage(data) }
    } catch (cause) {
      return failure(c, cause) as never
    }
    return start(c, input, householdId) as never
  })

  app.openapi(getJob, async (c) => {
    const user = c.get("user")
    const job = await jobs.forUser(c.req.valid("param").jobId, user.id)
    if (!job) return c.json({ error: "Job not found" }, 404)
    return c.json({ job: await present(job, user.id) }, 200)
  })

  return app
}
