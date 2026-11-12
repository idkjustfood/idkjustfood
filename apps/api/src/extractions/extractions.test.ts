import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, test } from "bun:test"

// App first: it loads @hono/zod-openapi before the shared schemas are created.
import { createApp } from "../app.js"

import { schema, type Database } from "@workspace/database"
import {
  runExtractionJob,
  ExtractionError,
  type JobQueue,
} from "@workspace/extraction"
import {
  fakeAi,
  fakeMedia,
  noAi,
  pancakeJson,
  tinyPng,
} from "@workspace/extraction/testing"
import type { Recipe } from "@workspace/schemas"

import { client, createTestDb, testEnv } from "../test-helpers.js"

type Job = {
  id: string
  status: "queued" | "running" | "succeeded" | "failed"
  error: string | null
  errorCode: string | null
  recipe: Recipe | null
}

let db: Database
let app: ReturnType<typeof createApp>
let api: ReturnType<typeof client>
let queued: string[]
let olivia: string

const withKey = {
  ...testEnv,
  AI_PROVIDER: "openrouter",
  AI_API_KEY: "test-key",
}

const queue: JobQueue = {
  enqueue: async (jobId) => {
    queued.push(jobId)
  },
}

function setUp(env: Record<string, string | undefined> = withKey) {
  app = createApp(db, env, { queue })
  api = client(app)
}

beforeEach(async () => {
  db = await createTestDb()
  queued = []
  setUp()
  olivia = await api.signUp("Olivia")
})

async function body<T>(res: Response) {
  return (await res.json()) as T
}

async function startLink(url: string, cookie = olivia, extra: object = {}) {
  return api.post("/api/extractions/link", cookie, { url, ...extra })
}

async function job(id: string, cookie = olivia) {
  const res = await api.get(`/api/extractions/${id}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ job: Job }>(res)).job
}

async function upload(
  file: Blob | string,
  cookie = olivia,
  extra: Record<string, string> = {}
) {
  const form = new FormData()
  form.set("image", file as Blob, "recipe.png")
  for (const [key, value] of Object.entries(extra)) form.set(key, value)
  return app.request("/api/extractions/image", {
    method: "POST",
    headers: { origin: testEnv.BETTER_AUTH_URL, cookie },
    body: form,
  })
}

const reel = "https://www.instagram.com/reel/Cabc123/"

describe("starting a job", () => {
  test("needs a signed-in user", async () => {
    expect(
      (await api.post("/api/extractions/link", undefined, { url: reel })).status
    ).toBe(401)
    expect((await api.get("/api/extractions/abc")).status).toBe(401)
    expect((await upload(new Blob([tinyPng]), "")).status).toBe(401)
  })

  test("a video link is queued", async () => {
    const res = await startLink(reel)
    expect(res.status).toBe(202)
    const { job: started } = await body<{ job: Job }>(res)
    expect(started).toMatchObject({
      status: "queued",
      error: null,
      recipe: null,
    })
    expect(queued).toEqual([started.id])
  })

  test("pasted text is queued", async () => {
    const res = await api.post("/api/extractions/text", olivia, {
      text: "Pancakes: flour, milk",
    })
    expect(res.status).toBe(202)
    expect(queued).toHaveLength(1)
  })

  test("a photo is queued", async () => {
    const res = await upload(new Blob([tinyPng], { type: "image/png" }))
    expect(res.status).toBe(202)
    expect(queued).toHaveLength(1)
  })
})

describe("clear errors instead of crashes", () => {
  const refused = async (res: Response, status: number, code: string) => {
    expect(res.status).toBe(status)
    const data = await body<{ error: string; code?: string }>(res)
    expect(data.code).toBe(code)
    expect(data.error.length).toBeGreaterThan(10)
    expect(queued).toEqual([])
  }

  test("an unsupported link", async () => {
    await refused(
      await startLink("ftp://example.com/recipe"),
      400,
      "unsupported_link"
    )
    await refused(await startLink("not a link"), 400, "unsupported_link")
  })

  test("a platform link that is not a video", async () => {
    await refused(
      await startLink("https://www.instagram.com/some_chef/"),
      400,
      "unsupported_link"
    )
  })

  test("a website link to a local or private network address", async () => {
    for (const url of [
      "http://localhost:3001/health",
      "http://127.0.0.1:5432/",
      "http://10.0.0.5/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
    ]) {
      await refused(await startLink(url), 400, "private_address")
    }
  })

  test("empty or oversized text", async () => {
    expect(
      (await api.post("/api/extractions/text", olivia, { text: "" })).status
    ).toBe(400)
    expect(
      (
        await api.post("/api/extractions/text", olivia, {
          text: "x".repeat(20_001),
        })
      ).status
    ).toBe(400)
    expect(queued).toEqual([])
  })

  test("a file that is not an image", async () => {
    await refused(
      await upload(new Blob(["just some words"], { type: "image/png" })),
      400,
      "invalid_input"
    )
  })

  test("an image that is too large", async () => {
    const big = new Uint8Array(11 * 1024 * 1024)
    big.set(tinyPng)
    const res = await upload(new Blob([big], { type: "image/png" }))
    expect(res.status).toBe(400)
    expect(queued).toEqual([])
  })

  test("a missing image field", async () => {
    const res = await app.request("/api/extractions/image", {
      method: "POST",
      headers: { origin: testEnv.BETTER_AUTH_URL, cookie: olivia },
      body: new FormData(),
    })
    expect(res.status).toBe(400)
  })

  test("a household the user is not in", async () => {
    const res = await startLink(reel, olivia, { householdId: "nope" })
    expect(res.status).toBe(404)
    expect(queued).toEqual([])
  })
})

describe("no AI key", () => {
  beforeEach(async () => {
    db = await createTestDb()
    queued = []
    setUp({ ...testEnv })
    olivia = await api.signUp("Olivia")
  })

  test("videos, photos and text say so clearly", async () => {
    for (const res of [
      await startLink(reel),
      await api.post("/api/extractions/text", olivia, { text: "Pancakes" }),
      await upload(new Blob([tinyPng], { type: "image/png" })),
    ]) {
      expect(res.status).toBe(503)
      const data = await body<{ error: string; code: string }>(res)
      expect(data.code).toBe("ai_not_configured")
      expect(data.error).toContain("AI_API_KEY")
    }
    expect(queued).toEqual([])
  })

  test("a website link is still accepted, and a page with recipe data works without AI", async () => {
    const res = await startLink("http://93.184.216.34/pasta")
    expect(res.status).toBe(202)
    const { job: started } = await body<{ job: Job }>(res)

    const page = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Recipe",
      name: "Pasta",
      recipeIngredient: ["400 g spaghetti", "salt"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Boil." }],
    })}</script>`
    await runExtractionJob(db, started.id, {
      ai: noAi,
      fetchPage: async (url) => ({ url, html: page }),
    })

    const done = await job(started.id)
    expect(done.status).toBe("succeeded")
    expect(done.recipe).toMatchObject({
      title: "Pasta",
      source: { kind: "website", url: "http://93.184.216.34/pasta" },
    })
    expect(done.recipe!.ingredients[1]).toMatchObject({
      name: "salt",
      quantity: null,
    })
  })

  test("a website without recipe data fails the job with the same message", async () => {
    const { job: started } = await body<{ job: Job }>(
      await startLink("http://93.184.216.34/page")
    )
    const { createAi } = await import("@workspace/extraction")
    await runExtractionJob(db, started.id, {
      ai: createAi({}),
      fetchPage: async (url) => ({ url, html: "<p>Mix flour and water.</p>" }),
    })
    const done = await job(started.id)
    expect(done).toMatchObject({
      status: "failed",
      errorCode: "ai_not_configured",
    })
    expect(done.error).toContain("AI_API_KEY")
  })
})

describe("running a job and reading the result", () => {
  test("a video becomes a saved recipe", async () => {
    const { job: started } = await body<{ job: Job }>(await startLink(reel))
    await runExtractionJob(db, started.id, { ai: fakeAi(), media: fakeMedia() })

    const done = await job(started.id)
    expect(done.status).toBe("succeeded")
    expect(done.recipe).toMatchObject({
      title: "Pancakes",
      servings: 4,
      source: { kind: "video", label: "Instagram reel · @chef", url: reel },
    })
    expect(
      done.recipe!.ingredients.find((i) => i.name === "salt")!.quantity
    ).toBeNull()

    // It is in the user's saved recipes, and only theirs.
    const list = await body<{ recipes: Recipe[] }>(
      await api.get("/api/recipes", olivia)
    )
    expect(list.recipes.map((r) => r.id)).toEqual([done.recipe!.id])
    const other = await api.signUp("Oscar")
    expect(
      (await body<{ recipes: Recipe[] }>(await api.get("/api/recipes", other)))
        .recipes
    ).toEqual([])
  })

  test("a photo becomes a recipe and the upload is not kept", async () => {
    const { job: started } = await body<{ job: Job }>(
      await upload(new Blob([tinyPng], { type: "image/png" }))
    )
    const [before] = await db
      .select()
      .from(schema.extractionJob)
      .where(eq(schema.extractionJob.id, started.id))
    expect(before!.image).toBeTruthy()

    const ai = fakeAi()
    await runExtractionJob(db, started.id, { ai })
    expect(ai.calls.readImages[0]![0]!.mediaType).toBe("image/png")

    const [after] = await db
      .select()
      .from(schema.extractionJob)
      .where(eq(schema.extractionJob.id, started.id))
    expect(after!.status).toBe("succeeded")
    expect(after!.image).toBeNull()
    expect((await job(started.id)).recipe!.source.kind).toBe("photo")
  })

  test("pasted text becomes a recipe and the text is not kept", async () => {
    const { job: started } = await body<{ job: Job }>(
      await api.post("/api/extractions/text", olivia, {
        text: "Pancakes: 200 g flour",
      })
    )
    await runExtractionJob(db, started.id, { ai: fakeAi() })
    const [row] = await db
      .select()
      .from(schema.extractionJob)
      .where(eq(schema.extractionJob.id, started.id))
    expect(row!.text).toBeNull()
    expect((await job(started.id)).recipe!.source.kind).toBe("text")
  })

  test("the recipe can be shared with a household", async () => {
    const created = await api.post("/api/households", olivia, { name: "Home" })
    const { household } = await body<{ household: { id: string } }>(created)

    const { job: started } = await body<{ job: Job }>(
      await api.post("/api/extractions/text", olivia, {
        text: "Pancakes",
        householdId: household.id,
      })
    )
    await runExtractionJob(db, started.id, { ai: fakeAi() })

    expect((await job(started.id)).recipe!.householdId).toBe(household.id)
    const list = await body<{ recipes: Recipe[] }>(
      await api.get(`/api/recipes?householdId=${household.id}`, olivia)
    )
    expect(list.recipes).toHaveLength(1)
  })

  test("a failure is saved on the job with a readable message", async () => {
    const { job: started } = await body<{ job: Job }>(await startLink(reel))
    await runExtractionJob(db, started.id, {
      ai: fakeAi({
        parseRecipe: async () => ({ ...pancakeJson, servings: "many" }),
      }),
      media: fakeMedia(),
    })
    const done = await job(started.id)
    expect(done).toMatchObject({
      status: "failed",
      errorCode: "invalid_recipe",
      recipe: null,
    })
    expect(done.error).toContain("servings")
    const list = await body<{ recipes: Recipe[] }>(
      await api.get("/api/recipes", olivia)
    )
    expect(list.recipes).toEqual([])
  })

  test("an unexpected crash is reported without details", async () => {
    const { job: started } = await body<{ job: Job }>(await startLink(reel))
    const log = console.error
    console.error = () => {}
    try {
      await runExtractionJob(db, started.id, {
        ai: fakeAi({
          parseRecipe: async () => {
            throw new Error("secret internal detail with key sk-123")
          },
        }),
        media: fakeMedia(),
      })
    } finally {
      console.error = log
    }
    const done = await job(started.id)
    expect(done.status).toBe("failed")
    expect(done.error).not.toContain("sk-123")
  })

  test("a private video fails the job with a clear message", async () => {
    const { job: started } = await body<{ job: Job }>(await startLink(reel))
    await runExtractionJob(db, started.id, {
      ai: fakeAi(),
      media: {
        ...fakeMedia(),
        download: async () => {
          throw new ExtractionError(
            "video_unavailable",
            "That video is private or needs a login."
          )
        },
      },
    })
    expect(await job(started.id)).toMatchObject({
      status: "failed",
      errorCode: "video_unavailable",
      error: "That video is private or needs a login.",
    })
  })

  test("running the same job twice saves one recipe", async () => {
    const { job: started } = await body<{ job: Job }>(
      await api.post("/api/extractions/text", olivia, { text: "Pancakes" })
    )
    await Promise.all([
      runExtractionJob(db, started.id, { ai: fakeAi() }),
      runExtractionJob(db, started.id, { ai: fakeAi() }),
    ])
    const list = await body<{ recipes: Recipe[] }>(
      await api.get("/api/recipes", olivia)
    )
    expect(list.recipes).toHaveLength(1)
  })
})

describe("reading a job", () => {
  test("only its owner can see it", async () => {
    const { job: started } = await body<{ job: Job }>(await startLink(reel))
    const oscar = await api.signUp("Oscar")
    expect(
      (await api.get(`/api/extractions/${started.id}`, oscar)).status
    ).toBe(404)
    expect(
      (await api.get("/api/extractions/does-not-exist", olivia)).status
    ).toBe(404)
  })

  test("a job that never finished is reported as failed", async () => {
    const { job: started } = await body<{ job: Job }>(await startLink(reel))
    await db
      .update(schema.extractionJob)
      .set({
        status: "running",
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      })
      .where(eq(schema.extractionJob.id, started.id))
    expect(await job(started.id)).toMatchObject({ status: "failed" })
  })
})

test("another input module can be plugged in without touching the routes", async () => {
  const custom = createApp(db, withKey, {
    queue,
    modules: [
      {
        id: "demo",
        needsAi: false,
        canHandle: (input) =>
          input.type === "link" && input.url.startsWith("demo:"),
        gather: async () => ({
          source: { kind: "import", label: null, url: null },
          texts: [],
          images: [],
        }),
      },
    ],
  })
  const demo = client(custom)
  const cookie = await demo.signUp("Dana")
  expect(
    (await demo.post("/api/extractions/link", cookie, { url: "demo:1" })).status
  ).toBe(202)
  // The built-in Instagram module is not in this list, so the link is unknown here.
  expect(
    (await demo.post("/api/extractions/link", cookie, { url: reel })).status
  ).toBe(400)
})
