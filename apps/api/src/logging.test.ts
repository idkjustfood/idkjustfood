import { beforeEach, describe, expect, test } from "bun:test"

// App first: it loads @hono/zod-openapi before the shared schemas are created.
import { createApp } from "./app.js"

import type { Database } from "@workspace/database"
import { runExtractionJob, type JobQueue } from "@workspace/extraction"
import { fakeAi, fakeMedia } from "@workspace/extraction/testing"
import { createLogger } from "@workspace/logger"

import { client, createTestDb, testEnv } from "./test-helpers.js"

let db: Database
let lines: string[]
const entries = () => lines.map((line) => JSON.parse(line))
const logger = () =>
  createLogger({ level: "debug", write: (line) => lines.push(line) })

const withKey = { ...testEnv, AI_PROVIDER: "openrouter", AI_API_KEY: "k" }

beforeEach(async () => {
  db = await createTestDb()
  lines = []
})

describe("request logging", () => {
  test("logs method, path, status and duration for every request", async () => {
    const app = createApp(db, testEnv, { logger: logger() })
    await app.request("/api/config")
    const entry = entries().find((e) => e.msg === "request")
    expect(entry).toMatchObject({
      level: "info",
      method: "GET",
      path: "/api/config",
      status: 200,
    })
    expect(typeof entry.durationMs).toBe("number")
    expect(typeof entry.requestId).toBe("string")
  })

  test("gives every request its own ID and sends it back in a header", async () => {
    const app = createApp(db, testEnv, { logger: logger() })
    const first = await app.request("/health")
    const second = await app.request("/health")
    const id = first.headers.get("x-request-id")
    expect(id).toBeTruthy()
    expect(id).not.toBe(second.headers.get("x-request-id"))
    expect(entries()[0].requestId).toBe(id)
  })

  test("keeps a plain request ID sent by a proxy, and replaces a strange one", async () => {
    const app = createApp(db, testEnv, { logger: logger() })
    const kept = await app.request("/health", {
      headers: { "x-request-id": "proxy-id-12345" },
    })
    expect(kept.headers.get("x-request-id")).toBe("proxy-id-12345")
    const replaced = await app.request("/health", {
      headers: { "x-request-id": "bad id {}" },
    })
    expect(replaced.headers.get("x-request-id")).not.toContain("bad")
  })

  test("leaves the query out of the path", async () => {
    const app = createApp(db, testEnv, { logger: logger() })
    await app.request("/api/config?token=super-secret-value")
    expect(lines.join("\n")).not.toContain("super-secret-value")
  })

  test("the health check is only logged at debug level", async () => {
    const app = createApp(db, testEnv, {
      logger: createLogger({ write: (line) => lines.push(line) }),
    })
    await app.request("/health")
    expect(lines).toHaveLength(0)
  })

  test("client errors are warnings and include the user", async () => {
    const app = createApp(db, testEnv, { logger: logger() })
    const api = client(app)
    const cookie = await api.signUp("Olivia")
    lines.length = 0
    await api.get("/api/extractions/missing", cookie)
    await api.get("/api/extractions/missing")
    const [withUser, anonymous] = entries().filter((e) => e.msg === "request")
    expect(withUser).toMatchObject({ level: "warn", status: 404 })
    expect(typeof withUser.userId).toBe("string")
    expect(anonymous).toMatchObject({ level: "warn", status: 401 })
    expect(anonymous.userId).toBeUndefined()
  })

  test("an unhandled error is logged with its stack and the request ID", async () => {
    const app = createApp(db, testEnv, { logger: logger() })
    app.get("/boom", () => {
      throw new Error("kaboom")
    })
    const res = await app.request("/boom")
    expect(res.status).toBe(500)
    const id = res.headers.get("x-request-id")
    const failure = entries().find((e) => e.msg === "unhandled error")
    expect(failure).toMatchObject({
      level: "error",
      requestId: id,
      method: "GET",
      path: "/boom",
    })
    expect(failure.err.message).toBe("kaboom")
    expect(failure.err.stack).toContain("kaboom")
    const request = entries().find((e) => e.msg === "request")
    expect(request).toMatchObject({ status: 500, requestId: id })
  })

  test("does not log secrets from the settings or the request", async () => {
    const app = createApp(
      db,
      { ...withKey, AI_API_KEY: "sk-must-not-appear-123456" },
      { logger: logger() }
    )
    const api = client(app)
    const cookie = await api.signUp("Olivia")
    await api.post("/api/extractions/text", cookie, { text: "private recipe" })
    const text = lines.join("\n")
    expect(text).not.toContain("sk-must-not-appear")
    expect(text).not.toContain(cookie.split("=")[1]!.slice(0, 20))
    expect(text).not.toContain("private recipe")
    expect(text).not.toContain("correct-horse-battery")
  })
})

describe("following a request into its job", () => {
  test("the job logs carry the request ID of the request that created it", async () => {
    const queued: { jobId: string; requestId?: string }[] = []
    const queue: JobQueue = {
      enqueue: async (jobId, requestId) => {
        queued.push({ jobId, requestId })
      },
    }
    const log = logger()
    const app = createApp(db, withKey, { queue, logger: log })
    const api = client(app)
    const cookie = await api.signUp("Olivia")
    const res = await api.post("/api/extractions/text", cookie, {
      text: "Pancakes: flour, milk, eggs.",
    })
    expect(res.status).toBe(202)
    const { job } = (await res.json()) as { job: { id: string } }
    const requestId = res.headers.get("x-request-id")!
    expect(queued).toEqual([{ jobId: job.id, requestId }])

    // The worker takes the job off the queue and runs it.
    await runExtractionJob(
      db,
      queued[0]!.jobId,
      { ai: fakeAi(), media: fakeMedia(), logger: log },
      { requestId: queued[0]!.requestId }
    )

    const linked = entries().filter((e) => e.requestId === requestId)
    const messages = linked.map((e) => e.msg)
    expect(messages).toContain("request")
    expect(messages).toContain("extraction queued")
    expect(messages).toContain("job started")
    expect(messages).toContain("job finished")
    const finished = linked.find((e) => e.msg === "job finished")
    expect(finished.jobId).toBe(job.id)
    expect(typeof finished.durationMs).toBe("number")
  })

  test("a failed job shows which step failed and why", async () => {
    const log = logger()
    const queued: string[] = []
    const app = createApp(db, withKey, {
      queue: { enqueue: async (id) => void queued.push(id) },
      logger: log,
    })
    const api = client(app)
    const cookie = await api.signUp("Olivia")
    await api.post("/api/extractions/text", cookie, { text: "Some text" })
    lines.length = 0
    await runExtractionJob(db, queued[0]!, {
      ai: fakeAi({
        parseRecipe: async () => {
          throw new Error("provider returned 500")
        },
      }),
      media: fakeMedia(),
      logger: log,
    })
    const step = entries().find((e) => e.msg === "step failed")
    expect(step).toMatchObject({
      level: "error",
      step: "parsing",
      jobId: queued[0],
    })
    expect(step.err.message).toBe("provider returned 500")
    const failed = entries().find((e) => e.msg === "job crashed")
    expect(failed).toMatchObject({ level: "error", jobId: queued[0] })
  })
})
