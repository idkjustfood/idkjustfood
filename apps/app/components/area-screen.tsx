import { router, type Href } from "expo-router"
import { Blocks } from "lucide-react-native"
import { useTranslation } from "react-i18next"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { SearchButton } from "@/components/search-button"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState } from "@/components/states"
import { useAppState } from "@/lib/app-state"
import { useIsWide } from "@/lib/layout"
import { moduleIcon } from "@/lib/module-icons"
import {
  modulesInArea,
  type AppModule,
  type ModuleArea,
  type ModuleGroup,
} from "@/lib/modules"

const groupOrder: (ModuleGroup | undefined)[] = [undefined, "home", "family"]

/** The home screen of an area (Plan, Food, Money, More): its enabled modules as a list. */
export function AreaScreen({ area }: { area: ModuleArea }) {
  const { t } = useTranslation("modules")
  const wide = useIsWide()
  const { disabledModules } = useAppState()
  const items = modulesInArea(area, disabledModules)

  const row = (module: AppModule) => (
    <ListRow
      key={module.id}
      icon={moduleIcon(module.id)}
      title={t(`${module.id}.name`)}
      detail={
        module.built
          ? t(`${module.id}.description`)
          : `${t("comingSoon")} · ${t(`${module.id}.description`)}`
      }
      onPress={() => router.push(module.route as Href)}
    />
  )

  return (
    <Screen
      title={t(`areas.${area}`)}
      subtitle={t(`areaSubtitles.${area}`)}
      actions={<SearchButton />}
      toolbar={!wide ? <SpaceSwitcher /> : undefined}
      narrow
    >
      {items.length === 0 ? (
        <EmptyState
          icon={Blocks}
          title={t("area.emptyTitle")}
          message={t("area.emptyMessage")}
          action={t("area.manage")}
          onAction={() => router.push("/settings/modules")}
        />
      ) : (
        groupOrder.map((group) => {
          const inGroup = items.filter((m) => m.group === group)
          if (inGroup.length === 0) return null
          return (
            <ListGroup
              key={group ?? "main"}
              title={group ? t(`groups.${group}`) : undefined}
            >
              {inGroup.map(row)}
            </ListGroup>
          )
        })
      )}
    </Screen>
  )
}
