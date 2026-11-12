import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import type { RecipeContent } from "@workspace/schemas"

import type { ExtractionInput } from "../inputs/types.js"

const { extractionJob, recipe } = schema

export type JobRow = typeof extractionJob.$inferSelect
export type JobStatus = "queued" | "running" | "succeeded" | "failed"

/** Database queries for extraction jobs. */
export function jobStore(db: Database) {
  return {
    /** Adds a queued job for the user. The recipe will be shared with `householdId`, if set. */
    async create(
      userId: string,
      householdId: string | null,
      input: ExtractionInput
    ) {
      const [row] = await db
        .insert(extractionJob)
        .values({
          id: randomUUID(),
          userId,
          organizationId: householdId,
          kind: input.type,
          url: input.type === "link" ? input.url : null,
          text: input.type === "text" ? input.text : null,
          image: input.type === "image" ? input.data : null,
          imageType: input.type === "image" ? input.mediaType : null,
        })
        .returning()
      return row!
    },

    /** The job, only if it belongs to the user. */
    async forUser(jobId: string, userId: string) {
      const [row] = await db
        .select()
        .from(extractionJob)
        .where(
          and(eq(extractionJob.id, jobId), eq(extractionJob.userId, userId))
        )
      return row
    },

    async get(jobId: string) {
      const [row] = await db
        .select()
        .from(extractionJob)
        .where(eq(extractionJob.id, jobId))
      return row
    },

    /** Moves a queued job to running. False when it was not queued (already taken or gone). */
    async start(jobId: string) {
      const rows = await db
        .update(extractionJob)
        .set({ status: "running" })
        .where(
          and(eq(extractionJob.id, jobId), eq(extractionJob.status, "queued"))
        )
        .returning({ id: extractionJob.id })
      return rows.length > 0
    },

    /** Saves the recipe, marks the job done and drops the stored input. */
    async succeed(job: JobRow, content: RecipeContent) {
      const recipeId = randomUUID()
      await db.insert(recipe).values({
        id: recipeId,
        userId: job.userId,
        organizationId: job.organizationId,
        title: content.title,
        description: content.description,
        servings: content.servings,
        prepMinutes: content.prepMinutes,
        cookMinutes: content.cookMinutes,
        tags: content.tags,
        ingredients: content.ingredients,
        steps: content.steps,
        nutrition: content.nutrition,
        source: content.source,
      })
      await db
        .update(extractionJob)
        .set({
          status: "succeeded",
          recipeId,
          text: null,
          image: null,
          imageType: null,
        })
        .where(eq(extractionJob.id, job.id))
      return recipeId
    },

    /** Marks the job failed with a message for the person, and drops the stored input. */
    async fail(jobId: string, code: string, message: string) {
      await db
        .update(extractionJob)
        .set({
          status: "failed",
          errorCode: code,
          error: message,
          text: null,
          image: null,
          imageType: null,
        })
        .where(eq(extractionJob.id, jobId))
    },
  }
}

export type JobStore = ReturnType<typeof jobStore>
