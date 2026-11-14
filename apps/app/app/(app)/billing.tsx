import { useTranslation } from "react-i18next"

import { ComingSoon } from "@/components/coming-soon"
import { Screen } from "@/components/screen"

/**
 * Cloud-only placeholder. The route is guarded in (app)/_layout.tsx, so a self-hosted
 * build never shows it. The real billing screens are a separate ticket.
 */
export default function Billing() {
  const { t } = useTranslation()
  return (
    <Screen title={t("settings:billing.title")} back="/settings" narrow>
      <ComingSoon message={t("settings:billing.message")} />
    </Screen>
  )
}
