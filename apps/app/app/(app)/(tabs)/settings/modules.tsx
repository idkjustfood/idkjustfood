import { useTranslation } from "react-i18next"
import { Switch } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { useAppState } from "@/lib/app-state"
import { moduleIcon } from "@/lib/module-icons"
import { isEnabled, modules, type ModuleArea } from "@/lib/modules"

const areas: ModuleArea[] = ["life", "home", "food", "money", "more"]

/** Switch modules on or off. A module that is off is gone from navigation, Today, "+" and search. */
export default function ModulesSettings() {
  const { t } = useTranslation("modules")
  const { disabledModules, setModuleEnabled } = useAppState()

  return (
    <Screen
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
      back="/settings"
      narrow
    >
      {areas.map((area) => {
        const items = modules.filter((m) => m.area === area && !m.required)
        if (items.length === 0) return null
        return (
          <ListGroup key={area} title={t(`areas.${area}`)}>
            {items.map((module) => (
              <ListRow
                key={module.id}
                icon={moduleIcon(module.id)}
                title={t(`${module.id}.name`)}
                detail={t(`${module.id}.description`)}
                right={
                  <Switch
                    accessibilityLabel={t(`${module.id}.name`)}
                    value={isEnabled(module, disabledModules)}
                    onValueChange={(on) => setModuleEnabled(module.id, on)}
                  />
                }
              />
            ))}
          </ListGroup>
        )
      })}
    </Screen>
  )
}
