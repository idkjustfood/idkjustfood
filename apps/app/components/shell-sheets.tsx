import { router, type Href } from "expo-router"
import { useTranslation } from "react-i18next"
import { Text } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { quickActions } from "@/lib/modules"
import { moduleIcon } from "@/lib/module-icons"
import { useShell } from "@/lib/shell"

const go = (route: string) => router.push(route as Href)

/** The sheet every screen can open: "+" quick add. */
export function ShellSheets() {
  return <QuickAddSheet />
}

function QuickAddSheet() {
  const { t } = useTranslation("modules")
  const { quickAddOpen, setQuickAddOpen } = useShell()
  const { disabledModules } = useAppState()
  const actions = quickActions(disabledModules)

  return (
    <Sheet
      open={quickAddOpen}
      onClose={() => setQuickAddOpen(false)}
      title={t("quickAdd.title")}
    >
      {actions.length === 0 ? (
        <Text className="text-muted-foreground">{t("quickAdd.empty")}</Text>
      ) : (
        <ListGroup>
          {actions.map((module) => (
            <ListRow
              key={module.id}
              icon={moduleIcon(module.id)}
              title={t(`${module.id}.quickAction`)}
              detail={module.built ? undefined : t("comingSoon")}
              onPress={() => {
                setQuickAddOpen(false)
                go(module.quickAction!.route)
              }}
            />
          ))}
        </ListGroup>
      )}
    </Sheet>
  )
}
