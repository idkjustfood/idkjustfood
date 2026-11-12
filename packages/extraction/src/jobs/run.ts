import type { Database } from "@workspace/database"

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

/**
 * Runs one job: reads the input, builds the recipe, saves it. Never throws for a
 * failed extraction: the job row gets the message instead. Safe to call twice for
 * the same job, the second call does nothing.
 */
export async function runExtractionJob(
  db: Database,
  jobId: string,
  options: PipelineOptions
) {
  const store = jobStore(db)
  if (!(await store.start(jobId))) return
  const job = await store.get(jobId)
  if (!job) return

  try {
    const content = await extractRecipe(inputOf(job), options)
    await store.succeed(job, content)
  } catch (cause) {
    if (cause instanceof ExtractionError) {
      await store.fail(jobId, cause.code, cause.message)
    } else {
      console.error(`extraction job ${jobId} crashed`, cause)
      await store.fail(
        jobId,
        "ai_failed",
        "Something went wrong while reading the recipe. Try again."
      )
    }
  }
}
