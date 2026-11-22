import { todayString, weekStart } from "@workspace/schemas"

import { useAppState } from "@/lib/app-state"
import { useCalendarState } from "@/lib/calendar"
import { useChoreState, useToday } from "@/lib/chores"
import { useHousehold } from "@/lib/households"
import { useMoneyState } from "@/lib/money"
import { moneyOfSpace } from "@/lib/money-view"
import { usePlans, useWeek } from "@/lib/planner"
import { useShoppingState } from "@/lib/shopping"
import { inSpace } from "@/lib/space"
import {
  billItems,
  calendarItems,
  choreItems,
  mealItems,
  shoppingItems,
  timeline,
} from "@/lib/today"

/**
 * What is on today, from every enabled module that provides items (the calendar, the meal
 * planner, shopping, chores and bills for now). The calendar also brings tomorrow's entries, and shows
 * personal and household entries together, whichever space is selected. To add a module, add its items here; see `docs/adding-a-module.md`.
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
  const { chores } = useChoreState()
  const { entries } = useCalendarState()
  const money = useMoneyState().data
  const choreDay = useToday()

  const items = timeline(
    [
      ...calendarItems(entries, choreDay),
      ...mealItems(week.data?.meals ?? [], today),
      ...shoppingItems(inSpace(lists, space)),
      ...choreItems(inSpace(chores, space), choreDay),
      ...billItems(moneyOfSpace(money, space).bills, choreDay),
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
