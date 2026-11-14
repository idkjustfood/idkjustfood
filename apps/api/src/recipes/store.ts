import { randomUUID } from "node:crypto"
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"
import type { RecipeContent, TagKey } from "@workspace/schemas"

import { householdStore } from "../households/store.js"

const { recipe } = schema

export type RecipeRow = typeof recipe.$inferSelect

/** Escapes `%`, `_` and `\` so a search text is matched literally by ILIKE. */
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`
}

export type RecipeFilters = {
  /** Words to look for in the title and in ingredient names. */
  q?: string
  /** Every one of these tags must be on the recipe. */
  tags?: TagKey[]
}

/** Database queries for recipes. Who may see a recipe is decided in `access`. */
export function recipeStore(db: Database) {
  const households = householdStore(db)

  /** The recipe, if this user may see it: their own, or one of a household they are in. */
  async function access(recipeId: string, userId: string) {
    const [row] = await db.select().from(recipe).where(eq(recipe.id, recipeId))
    if (!row) return undefined
    if (!row.organizationId) {
      return row.userId === userId ? { row, householdRole: null } : undefined
    }
    const membership = await households.membership(row.organizationId, userId)
    return membership ? { row, householdRole: membership.role } : undefined
  }

  function values(content: RecipeContent) {
    return {
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
    }
  }

  return {
    access,

    /**
     * The recipes of one space: a household, or (without `householdId`) the
     * user's own. Callers check household membership first.
     */
    list(
      userId: string,
      householdId: string | null,
      { q, tags }: RecipeFilters
    ) {
      const where: (SQL | undefined)[] = [
        householdId
          ? eq(recipe.organizationId, householdId)
          : and(isNull(recipe.organizationId), eq(recipe.userId, userId)),
      ]
      const text = q?.trim()
      if (text) {
        const pattern = likePattern(text)
        where.push(sql`(
          ${recipe.title} ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(${recipe.ingredients}) AS ingredient
            WHERE ingredient->>'name' ILIKE ${pattern}
          )
        )`)
      }
      if (tags?.length) {
        where.push(sql`${recipe.tags} @> ${sql`ARRAY[${sql.join(
          tags.map((tag) => sql`${tag}`),
          sql`, `
        )}]::text[]`}`)
      }
      return db
        .select()
        .from(recipe)
        .where(and(...where))
        .orderBy(desc(recipe.createdAt), desc(recipe.id))
    },

    async create(
      userId: string,
      householdId: string | null,
      content: RecipeContent
    ) {
      const [row] = await db
        .insert(recipe)
        .values({
          id: randomUUID(),
          userId,
          organizationId: householdId,
          ...values(content),
        })
        .returning()
      return row!
    },

    async update(
      recipeId: string,
      content: RecipeContent,
      householdId?: string | null
    ) {
      const [row] = await db
        .update(recipe)
        .set({
          ...values(content),
          ...(householdId !== undefined ? { organizationId: householdId } : {}),
        })
        .where(eq(recipe.id, recipeId))
        .returning()
      return row
    },

    async remove(recipeId: string) {
      await db.delete(recipe).where(eq(recipe.id, recipeId))
    },
  }
}

export type RecipeStore = ReturnType<typeof recipeStore>
