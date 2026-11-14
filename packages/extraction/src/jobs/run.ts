import type { Database } from "@workspace/database"
import { silentLogger } from "@workspace/logger"
import { toRecipeLanguage } from "@workspace/schemas"

import { ExtractionError } from "../errors.js"
import type { ExtractionInput } from "../inputs/types.js"
import { extractRecipe, type PipelineOptions } from "../pipeline.js"
import { jobStore, type JobRow } from "./store.js"

function inputOf(job: JobRow): ExtractionInput {
  if (job.kind === "link" && job.url) return { type: "link", url: job.url }
  if (job.kind === "text" && job.text !== null)
    return { type: "text", text: job.text }
  if (job.kind === "image" && job.image) {
    return {
      type: "image",
      data: new Uint8Array(job.image),
      mediaType: job.imageType ?? "image/jpeg",
    }
  }
  throw new ExtractionError("invalid_input", "The job has no input.")
}

export type JobContext = {
  /** The ID of the API request that created the job, to link the two in the logs. */
  requestId?: string
}

/**
 * Runs one job: reads the input, builds the recipe, saves it. Never throws for a
 * failed extraction: the job row gets the message instead. Safe to call twice for
 * the same job, the second call does nothing.
 */
export async function runExtractionJob(
  db: Database,
  jobId: string,
  options: PipelineOptions,
  context: JobContext = {}
) {
  const log = (options.logger ?? silentLogger).child({
    jobId,
    requestId: context.requestId,
  })
  const store = jobStore(db)
  if (!(await store.start(jobId))) {
    log.debug("job skipped: it is not queued (already taken or gone)")
    return
  }
  const job = await store.get(jobId)
  if (!job) {
    log.warn("job skipped: it no longer exists")
    return
  }

  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  log.info("job started", {
    kind: job.kind,
    language: job.language ?? undefined,
  })
  try {
    const content = await extractRecipe(inputOf(job), {
      ...options,
      // The language of the job wins over a default of the worker.
      language: toRecipeLanguage(job.language) ?? options.language,
      logger: log,
    })
    const recipeId = await store.succeed(job, content)
    log.info("job finished", { durationMs: elapsed(), recipeId })
  } catch (cause) {
    if (cause instanceof ExtractionError) {
      log.warn("job failed", {
        durationMs: elapsed(),
        code: cause.code,
        reason: cause.message,
      })
      await store.fail(jobId, cause.code, cause.message)
    } else {
      log.error("job crashed", { durationMs: elapsed(), err: cause })
      await store.fail(
        jobId,
        "ai_failed",
        "Something went wrong while reading the recipe. Try again."
      )
    }
  }
}
