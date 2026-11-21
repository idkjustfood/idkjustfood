import { todayString, weekStart } from "@workspace/schemas"

import { useAppState } from "@/lib/app-state"
import { useHousehold } from "@/lib/households"
import { usePlans, useWeek } from "@/lib/planner"
import { useShoppingState } from "@/lib/shopping"
import { inSpace } from "@/lib/space"
import { mealItems, shoppingItems, timeline } from "@/lib/today"

/**
 * What is on today, from every enabled module that provides items (the meal planner and
 * shopping for now). To add a module, add its items here; see `docs/adding-a-module.md`.
 */
export function useTodayItems() {
  const { demo, disabledModules } = useAppState()
  const { household } = useHousehold()
  const space = household?.id ?? null
  const today = todayString()

  const plans = usePlans()
  const plan = inSpace(plans.data ?? [], space)[0]
  const week = useWeek(plan?.id, weekStart(today))
  const { lists } = useShoppingState()

  const items = timeline(
    [
      ...mealItems(week.data?.meals ?? [], today),
      ...shoppingItems(inSpace(lists, space)),
    ],
    disabledModules
  )
  return {
    items,
    loading: !demo && plans.isPending,
    error: !demo && (plans.isError || week.isError),
    retry: () => {
      void plans.refetch()
      void week.refetch()
    },
  }
}
