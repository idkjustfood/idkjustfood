import { randomUUID } from "node:crypto"
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import { mealSlots, type MealSlot } from "@workspace/schemas"

import { householdStore } from "../households/store.js"
import { recipeStore, type RecipeRow } from "../recipes/store.js"

const { mealPlan, mealPlanMeal, recipe } = schema

export type MealPlanRow = typeof mealPlan.$inferSelect
export type MealRow = typeof mealPlanMeal.$inferSelect
/** A meal together with the recipe in it. */
export type MealWithRecipe = { meal: MealRow; recipe: RecipeRow }

export type DateRange = { from?: string; to?: string }

/** Database queries for meal plans. Who may see a plan is decided in `access`. */
export function plannerStore(db: Database) {
  const households = householdStore(db)
  const recipes = recipeStore(db)

  /**
   * The plan, if this user may see it: their own personal plan, or a plan of a
   * household they are in. `householdRole` is null for personal plans.
   */
  async function access(planId: string, userId: string) {
    const [row] = await db
      .select()
      .from(mealPlan)
      .where(eq(mealPlan.id, planId))
    if (!row) return undefined
    if (!row.organizationId) {
      return row.userId === userId ? { row, householdRole: null } : undefined
    }
    const membership = await households.membership(row.organizationId, userId)
    return membership ? { row, householdRole: membership.role } : undefined
  }

  function inRange(planId: string, { from, to }: DateRange) {
    const where: (SQL | undefined)[] = [eq(mealPlanMeal.planId, planId)]
    if (from) where.push(gte(mealPlanMeal.date, from))
    if (to) where.push(lte(mealPlanMeal.date, to))
    return and(...where)
  }

  /** Meals of one plan, with their recipes, by day and then breakfast, midday, afternoon. */
  async function meals(planId: string, range: DateRange = {}) {
    const rows = await db
      .select({ meal: mealPlanMeal, recipe })
      .from(mealPlanMeal)
      .innerJoin(recipe, eq(recipe.id, mealPlanMeal.recipeId))
      .where(inRange(planId, range))
      .orderBy(asc(mealPlanMeal.date))
    // The slots are not in alphabetical order, so they are sorted here.
    const order = (row: MealWithRecipe) =>
      mealSlots.indexOf(row.meal.slot as MealSlot)
    return (rows as MealWithRecipe[]).sort(
      (a, b) => a.meal.date.localeCompare(b.meal.date) || order(a) - order(b)
    )
  }

  return {
    access,
    meals,

    /** Every plan the user may see: their personal plans and their households' plans. */
    async listForUser(userId: string) {
      const memberships = await households.listForUser(userId)
      const ids = memberships.map((m) => m.id)
      return db
        .select()
        .from(mealPlan)
        .where(
          or(
            and(isNull(mealPlan.organizationId), eq(mealPlan.userId, userId)),
            ids.length > 0 ? inArray(mealPlan.organizationId, ids) : undefined
          )
        )
        .orderBy(asc(mealPlan.createdAt), asc(mealPlan.id))
    },

    /** Makes a plan. An id that exists already returns that plan, so a retry is harmless. */
    async create(
      userId: string,
      householdId: string | null,
      name: string,
      id?: string
    ) {
      const planId = id ?? randomUUID()
      const [row] = await db
        .insert(mealPlan)
        .values({ id: planId, userId, organizationId: householdId, name })
        .onConflictDoNothing()
        .returning()
      return row ?? (await access(planId, userId))?.row
    },

    async rename(planId: string, name: string) {
      const [row] = await db
        .update(mealPlan)
        .set({ name })
        .where(eq(mealPlan.id, planId))
        .returning()
      return row
    },

    async remove(planId: string) {
      await db.delete(mealPlan).where(eq(mealPlan.id, planId))
    },

    /** Puts a recipe in a slot. What was there is replaced. */
    async setMeal(
      planId: string,
      date: string,
      slot: MealSlot,
      recipeId: string,
      servings: number
    ) {
      await db
        .insert(mealPlanMeal)
        .values({ id: randomUUID(), planId, date, slot, recipeId, servings })
        .onConflictDoUpdate({
          target: [mealPlanMeal.planId, mealPlanMeal.date, mealPlanMeal.slot],
          set: { recipeId, servings, updatedAt: new Date() },
        })
      await touch(planId)
    },

    async setServings(
      planId: string,
      date: string,
      slot: MealSlot,
      servings: number
    ) {
      const rows = await db
        .update(mealPlanMeal)
        .set({ servings })
        .where(
          and(
            eq(mealPlanMeal.planId, planId),
            eq(mealPlanMeal.date, date),
            eq(mealPlanMeal.slot, slot)
          )
        )
        .returning({ id: mealPlanMeal.id })
      if (rows.length > 0) await touch(planId)
      return rows.length > 0
    },

    async removeMeal(planId: string, date: string, slot: MealSlot) {
      const rows = await db
        .delete(mealPlanMeal)
        .where(
          and(
            eq(mealPlanMeal.planId, planId),
            eq(mealPlanMeal.date, date),
            eq(mealPlanMeal.slot, slot)
          )
        )
        .returning({ id: mealPlanMeal.id })
      if (rows.length > 0) await touch(planId)
      return rows.length > 0
    },

    /**
     * Writes the result of the automatic planner in one transaction: first empties
     * the `clear` slots, then sets the new meals.
     */
    async applyGenerated(
      planId: string,
      clear: { date: string; slot: MealSlot }[],
      planned: {
        date: string
        slot: MealSlot
        recipeId: string
        servings: number
      }[]
    ) {
      await db.transaction(async (tx) => {
        for (const { date, slot } of clear) {
          await tx
            .delete(mealPlanMeal)
            .where(
              and(
                eq(mealPlanMeal.planId, planId),
                eq(mealPlanMeal.date, date),
                eq(mealPlanMeal.slot, slot)
              )
            )
        }
        for (const meal of planned) {
          await tx
            .insert(mealPlanMeal)
            .values({ id: randomUUID(), planId, ...meal })
            .onConflictDoUpdate({
              target: [
                mealPlanMeal.planId,
                mealPlanMeal.date,
                mealPlanMeal.slot,
              ],
              set: { recipeId: meal.recipeId, servings: meal.servings },
            })
        }
        await tx
          .update(mealPlan)
          .set({ updatedAt: new Date() })
          .where(eq(mealPlan.id, planId))
      })
    },

    /**
     * The recipes a plan may use: a household plan only uses the household's
     * recipes (so every member can open them), a personal plan the user's own
     * recipes and those of their households.
     */
    async usableRecipes(plan: MealPlanRow, userId: string) {
      if (plan.organizationId) {
        return recipes.list(userId, plan.organizationId, {})
      }
      const memberships = await households.listForUser(userId)
      const lists = await Promise.all([
        recipes.list(userId, null, {}),
        ...memberships.map((m) => recipes.list(userId, m.id, {})),
      ])
      return lists.flat()
    },
  }

  async function touch(planId: string) {
    await db
      .update(mealPlan)
      .set({ updatedAt: new Date() })
      .where(eq(mealPlan.id, planId))
  }
}

export type PlannerStore = ReturnType<typeof plannerStore>
