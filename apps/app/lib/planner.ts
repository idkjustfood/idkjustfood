import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

import {
  addDays,
  type GenerateResult,
  type MealPlan,
  type MealSlot,
} from "@workspace/schemas"

import { api, ApiError, call, type Schemas } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { useHouseholds } from "@/lib/households"
import i18n from "@/lib/i18n"

export type { GenerateResult, MealPlan }

const keys = {
  all: ["meal-plans"] as const,
  list: (demo: boolean) => ["meal-plans", "list", demo] as const,
  week: (planId: string, start: string) =>
    ["meal-plans", "week", planId, start] as const,
}

const demoOnly = () => {
  throw new ApiError(i18n.t("planner:demoOnly"), 0)
}

/** Your personal plans and the plans of your household. Meals are not included. */
export function usePlans() {
  const { demo } = useAppState()
  const { isPending } = useHouseholds()
  return useQuery({
    queryKey: keys.list(demo),
    enabled: !isPending,
    queryFn: async (): Promise<MealPlan[]> =>
      demo ? [] : (await call(api.GET("/api/meal-plans"))).plans,
  })
}

/** The meals of one plan for the seven days from `start` (a Monday). */
export function useWeek(planId: string | undefined, start: string) {
  const { demo } = useAppState()
  return useQuery({
    queryKey: keys.week(planId ?? "", start),
    enabled: !!planId && !demo,
    // Keep showing the old week while the next one loads, so the screen does not jump.
    placeholderData: keepPreviousData,
    // A plan that was deleted is a final answer, not something to retry.
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 2,
    queryFn: async (): Promise<MealPlan> =>
      (
        await call(
          api.GET("/api/meal-plans/{planId}", {
            params: {
              path: { planId: planId! },
              query: { from: start, to: addDays(start, 6) },
            },
          })
        )
      ).plan,
  })
}

function refresh(client: QueryClient) {
  return client.invalidateQueries({ queryKey: keys.all })
}

/** Makes a plan: personal, or shared with the household when `householdId` is set. */
export function useCreatePlan() {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (input: {
      name: string
      householdId: string | null
    }): Promise<MealPlan> =>
      demo
        ? demoOnly()
        : (await call(api.POST("/api/meal-plans", { body: input }))).plan,
    onSuccess: () => refresh(client),
  })
}

export function useDeletePlan(planId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async () =>
      demo
        ? demoOnly()
        : call(
            api.DELETE("/api/meal-plans/{planId}", {
              params: { path: { planId } },
            })
          ),
    onSuccess: () => refresh(client),
  })
}

type SlotKey = { date: string; slot: MealSlot }

/** Puts a recipe in a slot (also to swap the recipe) with the servings to cook. */
export function useSetMeal(planId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async ({
      date,
      slot,
      recipeId,
      servings,
    }: SlotKey & { recipeId: string; servings: number }) =>
      demo
        ? demoOnly()
        : call(
            api.PUT("/api/meal-plans/{planId}/meals/{date}/{slot}", {
              params: { path: { planId, date, slot } },
              body: { recipeId, servings },
            })
          ),
    onSuccess: () => refresh(client),
  })
}

export function useSetServings(planId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async ({
      date,
      slot,
      servings,
    }: SlotKey & { servings: number }) =>
      demo
        ? demoOnly()
        : call(
            api.PATCH("/api/meal-plans/{planId}/meals/{date}/{slot}", {
              params: { path: { planId, date, slot } },
              body: { servings },
            })
          ),
    onSuccess: () => refresh(client),
  })
}

export function useRemoveMeal(planId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async ({ date, slot }: SlotKey) =>
      demo
        ? demoOnly()
        : call(
            api.DELETE("/api/meal-plans/{planId}/meals/{date}/{slot}", {
              params: { path: { planId, date, slot } },
            })
          ),
    onSuccess: () => refresh(client),
  })
}

/** Fills the plan automatically (plain code on the server, no AI). */
export function useGeneratePlan(planId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (
      request: Schemas["GeneratePlan"]
    ): Promise<GenerateResult> =>
      demo
        ? demoOnly()
        : call(
            api.POST("/api/meal-plans/{planId}/generate", {
              params: { path: { planId } },
              body: request,
            })
          ),
    onSuccess: () => refresh(client),
  })
}

/** Puts the ingredients of the plan's meals on a shopping list. Only runs when the user asks. */
export function useAddPlanToList(planId: string) {
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (input: {
      listId: string
      from?: string
      to?: string
    }) =>
      demo
        ? demoOnly()
        : call(
            api.POST("/api/meal-plans/{planId}/shopping-list", {
              params: { path: { planId } },
              body: input,
            })
          ),
  })
}
