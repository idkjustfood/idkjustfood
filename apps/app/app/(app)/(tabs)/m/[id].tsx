import { Redirect, useLocalSearchParams } from "expo-router"
import { useTranslation } from "react-i18next"
import { Text } from "react-native"

import { ComingSoon } from "@/components/coming-soon"
import { Screen } from "@/components/screen"
import { useAppState } from "@/lib/app-state"
import { getModule, isEnabled } from "@/lib/modules"

/**
 * The placeholder for a module that is not built yet: its name and what it will do.
 * A module that does not exist, or is switched off, goes back to Today.
 */
export default function ModulePlaceholder() {
  const { t } = useTranslation("modules")
  const { id } = useLocalSearchParams<{ id: string }>()
  const { disabledModules } = useAppState()
  const module = getModule(id)
  if (!module || !isEnabled(module, disabledModules)) return <Redirect href="/" />

  return (
    <Screen
      title={t(`${module.id}.name`)}
      subtitle={t(`areas.${module.area}`)}
      back={`/${module.area}`}
      narrow
    >
      <Text className="text-base text-foreground">
        {t(`${module.id}.description`)}
      </Text>
      <ComingSoon message={t(`${module.id}.soon`)} />
    </Screen>
  )
}
