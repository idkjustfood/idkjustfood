import { ComingSoon } from "@/components/coming-soon"
import { Screen } from "@/components/screen"

/**
 * Cloud-only placeholder. The route is guarded in (app)/_layout.tsx, so a self-hosted
 * build never shows it. The real billing screens are a separate ticket.
 */
export default function Billing() {
  return (
    <Screen title="Plan and billing" back="/settings" narrow>
      <ComingSoon message="Manage your idkjustfood Cloud plan here." />
    </Screen>
  )
}
