import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { ErrorState, LoadingState } from "@/components/states"
import { useToday } from "@/lib/chores"
import { useHousehold, useHouseholds } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { useMoneyActions, useMoneyState } from "@/lib/money"
import { moneyOfSpace, type SpaceMoney } from "@/lib/money-view"

export type MoneyContext = {
  money: SpaceMoney
  /** The selected household, or null for the person's own money. */
  householdId: string | null
  householdName: string | null
  actions: ReturnType<typeof useMoneyActions>
  today: string
}

/**
 * The frame of every money screen: title, the space switcher, the offline note and the loading
 * and error states. Money is shown for one space at a time (the person's own, or one household),
 * because every space has its own currency.
 */
export function MoneyScreen({
  title,
  subtitle,
  actions: headerActions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: (context: MoneyContext) => ReactNode
}) {
  const { t } = useTranslation("money")
  const wide = useIsWide()
  const today = useToday()
  const { household } = useHousehold()
  const { households } = useHouseholds()
  const { data, loaded, error, online, pending } = useMoneyState()
  const actions = useMoneyActions()
  const householdId = household?.id ?? null

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      narrow
      toolbar={!wide && <SpaceSwitcher />}
      actions={headerActions}
    >
      <OfflineBanner online={online} pending={pending} />
      {!loaded && !error && <LoadingState label={t("loading")} rows={3} />}
      {!loaded && error && (
        <ErrorState
          title={t("loadError.title")}
          message={t("loadError.message")}
          onRetry={() => void actions.sync()}
        />
      )}
      {loaded &&
        children({
          money: moneyOfSpace(data, householdId),
          householdId,
          householdName:
            households.find((h) => h.id === householdId)?.name ?? null,
          actions,
          today,
        })}
    </Screen>
  )
}
