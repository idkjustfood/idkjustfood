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

  function slotWhere(planId: string, date: string, slot: MealSlot) {
    return and(
      eq(mealPlanMeal.planId, planId),
      eq(mealPlanMeal.date, date),
      eq(mealPlanMeal.slot, slot)
    )
  }

  function inRange(planId: string, { from, to }: DateRange) {
    const where: (SQL | undefined)[] = [eq(mealPlanMeal.planId, planId)]
    if (from) where.push(gte(mealPlanMeal.date, from))
    if (to) where.push(lte(mealPlanMeal.date, to))
    return and(...where)
  }

  /**
   * Meals of one plan, with their recipes, by day, then breakfast, midday, afternoon, and
   * within a slot in the order they were added.
   */
  async function meals(planId: string, range: DateRange = {}) {
    const rows = await db
      .select({ meal: mealPlanMeal, recipe })
      .from(mealPlanMeal)
      .innerJoin(recipe, eq(recipe.id, mealPlanMeal.recipeId))
      .where(inRange(planId, range))
      .orderBy(
        asc(mealPlanMeal.date),
        asc(mealPlanMeal.createdAt),
        asc(mealPlanMeal.id)
      )
    // The slots are not in alphabetical order, so they are sorted here (a stable sort keeps
    // the order in which meals were added within a slot).
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

    /**
     * Adds a recipe to a slot, next to what is already there. The same recipe is only in a
     * slot once: adding it again changes its servings.
     */
    async addMeal(
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
          target: [
            mealPlanMeal.planId,
            mealPlanMeal.date,
            mealPlanMeal.slot,
            mealPlanMeal.recipeId,
          ],
          set: { servings, updatedAt: new Date() },
        })
      await touch(planId)
    },

    /** Puts one recipe in a slot and takes out everything else that was there. */
    async replaceSlot(
      planId: string,
      date: string,
      slot: MealSlot,
      recipeId: string,
      servings: number
    ) {
      await db.transaction(async (tx) => {
        await tx.delete(mealPlanMeal).where(slotWhere(planId, date, slot))
        await tx
          .insert(mealPlanMeal)
          .values({ id: randomUUID(), planId, date, slot, recipeId, servings })
      })
      await touch(planId)
    },

    /**
     * Changes one meal: its servings, its recipe, or both. Answers `"missing"` when the
     * plan has no such meal, and `"duplicate"` when the new recipe is already in that slot.
     */
    async updateMeal(
      planId: string,
      mealId: string,
      change: { servings?: number; recipeId?: string }
    ): Promise<"ok" | "missing" | "duplicate"> {
      const [current] = await db
        .select()
        .from(mealPlanMeal)
        .where(
          and(eq(mealPlanMeal.planId, planId), eq(mealPlanMeal.id, mealId))
        )
      if (!current) return "missing"
      if (change.recipeId && change.recipeId !== current.recipeId) {
        const [twin] = await db
          .select({ id: mealPlanMeal.id })
          .from(mealPlanMeal)
          .where(
            and(
              slotWhere(planId, current.date, current.slot as MealSlot),
              eq(mealPlanMeal.recipeId, change.recipeId)
            )
          )
        if (twin) return "duplicate"
      }
      await db
        .update(mealPlanMeal)
        .set({
          ...(change.servings !== undefined && { servings: change.servings }),
          ...(change.recipeId && { recipeId: change.recipeId }),
        })
        .where(eq(mealPlanMeal.id, mealId))
      await touch(planId)
      return "ok"
    },

    /** Takes one meal out of the plan. */
    async removeMealById(planId: string, mealId: string) {
      const rows = await db
        .delete(mealPlanMeal)
        .where(
          and(eq(mealPlanMeal.planId, planId), eq(mealPlanMeal.id, mealId))
        )
        .returning({ id: mealPlanMeal.id })
      if (rows.length > 0) await touch(planId)
      return rows.length > 0
    },

    /** Empties a slot: every meal in it goes. */
    async removeSlot(planId: string, date: string, slot: MealSlot) {
      const rows = await db
        .delete(mealPlanMeal)
        .where(slotWhere(planId, date, slot))
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
          await tx.delete(mealPlanMeal).where(slotWhere(planId, date, slot))
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
                mealPlanMeal.recipeId,
              ],
              set: { servings: meal.servings },
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
