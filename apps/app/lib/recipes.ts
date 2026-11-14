import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import type { Recipe, RecipeContent } from "@workspace/schemas"

import { api, ApiError, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { useHousehold } from "@/lib/households"
import {
  household as demoHousehold,
  importedRecipe,
  recipes as demoRecipes,
  type Recipe as SampleRecipe,
} from "@/lib/mock-data"

export type { Recipe }

/** What a form hands over: the recipe's content, with the source kept as it was. */
export type RecipeFields = Omit<RecipeContent, "source"> &
  Partial<Pick<RecipeContent, "source">>

export type RecipeFilters = { q: string; tags: string[] }

const keys = {
  all: ["recipes"] as const,
  list: (scope: unknown) => ["recipes", "list", scope] as const,
  one: (id: string, demo: boolean) => ["recipes", "one", id, demo] as const,
}

/** A sample recipe from the clickable prototype, in the shape the API uses. */
export function fromSample(sample: SampleRecipe): Recipe {
  return {
    id: sample.id,
    householdId: sample.space === "household" ? demoHousehold.id : null,
    userId: "demo-user",
    title: sample.title,
    description: sample.description,
    servings: sample.servings,
    prepMinutes: sample.prepMinutes,
    cookMinutes: sample.cookMinutes,
    tags: sample.tags,
    ingredients: sample.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note ?? null,
    })),
    steps: sample.steps.map((s) => ({ text: s.text })),
    nutrition: {
      calories: sample.nutrition.kcal,
      protein: sample.nutrition.protein,
      carbs: sample.nutrition.carbs,
      fat: sample.nutrition.fat,
    },
    source: {
      kind: sample.source.kind,
      label: sample.source.label,
      url: sample.source.url ?? null,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

const demoOnly = () => {
  throw new ApiError(
    "This doesn't work with sample data. Log in to save real recipes.",
    0
  )
}

/**
 * Where new recipes go and which recipes are listed: the user's own, or the
 * household's. `ready` is false while the household is still loading.
 */
export function useRecipeSpace() {
  const { space } = useAppState()
  const { household } = useHousehold()
  if (space === "household") {
    return { householdId: household?.id ?? null, ready: !!household }
  }
  return { householdId: null, ready: true }
}

/** The recipes of the current space, narrowed by a search text and tags. */
export function useRecipes(filters: RecipeFilters) {
  const { demo, space } = useAppState()
  const { householdId, ready } = useRecipeSpace()
  const q = filters.q.trim()
  const tags = filters.tags
  return useQuery({
    queryKey: keys.list({ demo, space, householdId, q, tags }),
    enabled: ready,
    // Keep showing the old list while a new search loads, so it does not flicker.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Recipe[]> => {
      if (demo) {
        const word = q.toLowerCase()
        return demoRecipes
          .filter((r) => r.space === space)
          .map(fromSample)
          .filter(
            (r) =>
              (!word ||
                r.title.toLowerCase().includes(word) ||
                r.ingredients.some((i) =>
                  i.name.toLowerCase().includes(word)
                )) &&
              tags.every((t) => r.tags.includes(t))
          )
      }
      return (
        await call(
          api.GET("/api/recipes", {
            params: {
              query: {
                householdId: householdId ?? undefined,
                q: q || undefined,
                tags: tags.length ? tags.join(",") : undefined,
              },
            },
          })
        )
      ).recipes
    },
  })
}

/** Every recipe you can see: your own and your household's. For picking one, for example for a shopping list. */
export function useAllRecipes() {
  const { demo } = useAppState()
  const { household, isPending } = useHousehold()
  const householdId = household?.id ?? null
  return useQuery({
    queryKey: keys.list({ demo, householdId, all: true }),
    enabled: !isPending,
    queryFn: async (): Promise<Recipe[]> => {
      if (demo) return demoRecipes.map(fromSample)
      const fetchFor = async (id: string | undefined) =>
        (
          await call(
            api.GET("/api/recipes", { params: { query: { householdId: id } } })
          )
        ).recipes
      const [own, shared] = await Promise.all([
        fetchFor(undefined),
        householdId ? fetchFor(householdId) : Promise.resolve([]),
      ])
      return [...own, ...shared]
    },
  })
}

export function useRecipe(id: string | undefined) {
  const { demo } = useAppState()
  return useQuery({
    queryKey: keys.one(id ?? "", demo),
    enabled: !!id,
    // A missing recipe is a final answer, not something to retry.
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 2,
    queryFn: async (): Promise<Recipe> => {
      if (demo) {
        const sample = [...demoRecipes, importedRecipe].find((r) => r.id === id)
        if (!sample) throw new ApiError("Recipe not found", 404)
        return fromSample(sample)
      }
      return (
        await call(
          api.GET("/api/recipes/{recipeId}", {
            params: { path: { recipeId: id! } },
          })
        )
      ).recipe
    },
  })
}

function refresh(client: QueryClient) {
  return client.invalidateQueries({ queryKey: keys.all })
}

/** Saves a new recipe in the current space. */
export function useCreateRecipe() {
  const client = useQueryClient()
  const { demo } = useAppState()
  const { householdId } = useRecipeSpace()
  return useMutation({
    mutationFn: async (fields: RecipeFields): Promise<Recipe> =>
      demo
        ? demoOnly()
        : (
            await call(
              api.POST("/api/recipes", {
                body: { ...fields, householdId },
              })
            )
          ).recipe,
    onSuccess: () => refresh(client),
  })
}

/** Saves changes to a recipe. It stays where it is (personal or household). */
export function useUpdateRecipe(id: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (fields: RecipeFields): Promise<Recipe> =>
      demo
        ? demoOnly()
        : (
            await call(
              api.PUT("/api/recipes/{recipeId}", {
                params: { path: { recipeId: id } },
                body: fields,
              })
            )
          ).recipe,
    onSuccess: () => refresh(client),
  })
}

export function useDeleteRecipe(id: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async () =>
      demo
        ? demoOnly()
        : call(
            api.DELETE("/api/recipes/{recipeId}", {
              params: { path: { recipeId: id } },
            })
          ),
    onSuccess: () => refresh(client),
  })
}
