import PgBoss from "pg-boss"

import type { Database } from "@workspace/database"

import type { PipelineOptions } from "../pipeline.js"
import { runExtractionJob } from "./run.js"

/** Name of the pg-boss queue for extraction jobs. */
export const extractionQueue = "extract-recipe"

/** What the API needs from the queue: put a job on it. Tests use a fake. */
export interface JobQueue {
  enqueue(jobId: string): Promise<void>
}

type QueueSettings = {
  /** A job that runs longer than this is dropped by pg-boss. */
  expireInSeconds: number
}

async function startBoss(databaseUrl: string) {
  const boss = new PgBoss(databaseUrl)
  boss.on("error", (error: Error) => console.error("pg-boss error", error))
  await boss.start()
  await boss.createQueue(extractionQueue)
  return boss
}

/** The queue used by the API. Jobs are stored in Postgres by pg-boss (no Redis). */
export async function createJobQueue(
  databaseUrl: string
): Promise<JobQueue & { stop(): Promise<void> }> {
  const boss = await startBoss(databaseUrl)
  const settings: QueueSettings = { expireInSeconds: 15 * 60 }
  return {
    async enqueue(jobId) {
      // No retries: AI calls cost money and failures are saved on the job.
      await boss.send(
        extractionQueue,
        { jobId },
        { retryLimit: 0, ...settings }
      )
    },
    stop: () => boss.stop({ graceful: true }),
  }
}

/** Starts the worker side: takes jobs off the queue and runs them. Returns a stop function. */
export async function startExtractionWorker(
  databaseUrl: string,
  db: Database,
  options: PipelineOptions,
  concurrency = 2
) {
  const boss = await startBoss(databaseUrl)
  await boss.work<{ jobId: string }>(
    extractionQueue,
    { batchSize: concurrency },
    async (jobs: PgBoss.Job<{ jobId: string }>[]) => {
      await Promise.all(
        jobs.map((job) => runExtractionJob(db, job.data.jobId, options))
      )
    }
  )
  return () => boss.stop({ graceful: true })
}
