import PgBoss from "pg-boss"

import type { Database } from "@workspace/database"
import { silentLogger, type Logger } from "@workspace/logger"

import type { PipelineOptions } from "../pipeline.js"
import { runExtractionJob } from "./run.js"

/** Name of the pg-boss queue for extraction jobs. */
export const extractionQueue = "extract-recipe"

/** What the API needs from the queue: put a job on it. Tests use a fake. */
export interface JobQueue {
  /** `requestId` is the ID of the API request, so the logs of both can be linked. */
  enqueue(jobId: string, requestId?: string): Promise<void>
}

type JobData = { jobId: string; requestId?: string }

type QueueSettings = {
  /** A job that runs longer than this is dropped by pg-boss. */
  expireInSeconds: number
}

async function startBoss(databaseUrl: string, log: Logger) {
  const boss = new PgBoss(databaseUrl)
  boss.on("error", (err: Error) => log.error("job queue error", { err }))
  await boss.start()
  await boss.createQueue(extractionQueue)
  return boss
}

/** The queue used by the API. Jobs are stored in Postgres by pg-boss (no Redis). */
export async function createJobQueue(
  databaseUrl: string,
  log: Logger = silentLogger
): Promise<JobQueue & { stop(): Promise<void> }> {
  const boss = await startBoss(databaseUrl, log)
  const settings: QueueSettings = { expireInSeconds: 15 * 60 }
  return {
    async enqueue(jobId, requestId) {
      // No retries: AI calls cost money and failures are saved on the job.
      await boss.send(extractionQueue, { jobId, requestId } satisfies JobData, {
        retryLimit: 0,
        ...settings,
      })
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
  const boss = await startBoss(databaseUrl, options.logger ?? silentLogger)
  await boss.work<JobData>(
    extractionQueue,
    { batchSize: concurrency },
    async (jobs: PgBoss.Job<JobData>[]) => {
      await Promise.all(
        jobs.map((job) =>
          runExtractionJob(db, job.data.jobId, options, {
            requestId: job.data.requestId,
          })
        )
      )
    }
  )
  return () => boss.stop({ graceful: true })
}
