import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"
import { recipe } from "./recipes.js"

/**
 * A meal plan. It belongs to the user who made it and, when shared, to a
 * household (a Better Auth organization). Without a household, only its owner sees it.
 * The plan covers any number of weeks: its meals are stored by date.
 */
export const mealPlan = pgTable(
  "meal_plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null means a personal plan. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("meal_plan_userId_idx").on(table.userId),
    index("meal_plan_organizationId_idx").on(table.organizationId),
  ]
)

/**
 * One meal: a recipe in one of the three slots (breakfast, midday, afternoon) of one
 * day. A slot holds at most one recipe. The date is a calendar day (`YYYY-MM-DD`).
 */
export const mealPlanMeal = pgTable(
  "meal_plan_meal",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => mealPlan.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    slot: text("slot").notNull(),
    /** A deleted recipe is taken out of the plan, which leaves its slot empty. */
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    servings: integer("servings").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("meal_plan_meal_slot_unique").on(
      table.planId,
      table.date,
      table.slot
    ),
    index("meal_plan_meal_recipeId_idx").on(table.recipeId),
  ]
)
