import type { TagKey, UnitKey } from "@workspace/schemas"
import { sql } from "drizzle-orm"
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A recipe. It belongs to the user who added it and, when shared, to a household
 * (a Better Auth organization). Ingredients, steps and nutrition are stored as
 * structured JSON; their shape is defined by the Zod schemas in `@workspace/schemas`.
 */
export const recipe = pgTable(
  "recipe",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means the recipe is only visible to its author. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    servings: integer("servings").notNull(),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    // Keys from the fixed list of tags (`tagKeys`), never free text.
    tags: text("tags")
      .array()
      .$type<TagKey[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    ingredients: jsonb("ingredients")
      .$type<
        {
          name: string
          quantity: number | null
          unit: UnitKey | null
          note: string | null
        }[]
      >()
      .notNull(),
    steps: jsonb("steps").$type<{ text: string }[]>().notNull(),
    nutrition: jsonb("nutrition")
      .$type<{
        calories: number | null
        protein: number | null
        carbs: number | null
        fat: number | null
      }>()
      .notNull(),
    source: jsonb("source")
      .$type<{ kind: string; label: string | null; url: string | null }>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("recipe_userId_idx").on(table.userId),
    index("recipe_organizationId_idx").on(table.organizationId),
  ]
)
