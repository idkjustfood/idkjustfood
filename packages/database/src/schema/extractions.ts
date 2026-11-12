import {
  customType,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"
import { recipe } from "./recipes.js"

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
})

/**
 * One request to turn a link, a photo or a text into a recipe. The API adds a
 * row and queues it; the worker does the work and fills in `status` and `recipeId`.
 * The input (`url`, `text`, `image`) is only needed while the job runs: the worker
 * clears `text` and `image` when it is done, so uploads are not kept.
 */
export const extractionJob = pgTable(
  "extraction_job",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The household the new recipe is shared with. Null means only the user. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    /** "link", "image" or "text". */
    kind: text("kind").notNull(),
    url: text("url"),
    text: text("text"),
    image: bytea("image"),
    imageType: text("image_type"),
    /** "queued", "running", "succeeded" or "failed". */
    status: text("status").notNull().default("queued"),
    /** A short code for the failure, like "ai_not_configured". */
    errorCode: text("error_code"),
    /** A message for the person, set when the job failed. */
    error: text("error"),
    recipeId: text("recipe_id").references(() => recipe.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("extraction_job_userId_idx").on(table.userId)]
)
