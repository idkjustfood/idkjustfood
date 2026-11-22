import { AreaSettingsButton } from "@/components/area-settings-button"
import type { MoneyContext } from "@/components/money-screen"
import { MoneySettingsSheet } from "@/components/money-settings-sheet"
import { useToday } from "@/lib/chores"
import { useHousehold, useHouseholds } from "@/lib/households"
import { useMoneyActions, useMoneyState } from "@/lib/money"
import { moneyOfSpace } from "@/lib/money-view"

/** The settings button of the Money area: currency and categories of the selected space. */
export function MoneySettingsButton() {
  const today = useToday()
  const { household } = useHousehold()
  const { households } = useHouseholds()
  const { data, loaded } = useMoneyState()
  const actions = useMoneyActions()
  const householdId = household?.id ?? null
  const context: MoneyContext = {
    money: moneyOfSpace(data, householdId),
    householdId,
    householdName: households.find((h) => h.id === householdId)?.name ?? null,
    actions,
    today,
  }
  if (!loaded) return null
  return (
    <AreaSettingsButton>
      {(sheet) => <MoneySettingsSheet {...sheet} context={context} />}
    </AreaSettingsButton>
  )
}
