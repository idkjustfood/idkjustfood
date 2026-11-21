import { router, type Href } from "expo-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { Sheet } from "@/components/ui/sheet"
import { SearchField } from "@/components/ui/search-field"
import { useAppState } from "@/lib/app-state"
import {
  enabledModules,
  quickActions,
  searchModules,
  type AppModule,
} from "@/lib/modules"
import { moduleIcon } from "@/lib/module-icons"
import { useShell } from "@/lib/shell"

const go = (route: string) => router.push(route as Href)

/** The two sheets every screen can open: "+" quick add and search. */
export function ShellSheets() {
  return (
    <>
      <QuickAddSheet />
      <SearchSheet />
    </>
  )
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

function SearchSheet() {
  const { t } = useTranslation("modules")
  const { searchOpen, setSearchOpen } = useShell()
  const { disabledModules } = useAppState()
  const [query, setQuery] = useState("")

  const close = () => {
    setSearchOpen(false)
    setQuery("")
  }
  const results = searchModules(
    enabledModules(disabledModules),
    query,
    (m: AppModule) =>
      `${t(`${m.id}.name`)} ${t(`${m.id}.description`)}`
  )

  return (
    <Sheet open={searchOpen} onClose={close} title={t("search.title")}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t("search.placeholder")}
      />
      {query.trim() === "" ? (
        <Text className="text-muted-foreground">{t("search.hint")}</Text>
      ) : results.length === 0 ? (
        <Text className="text-muted-foreground">
          {t("search.none", { query: query.trim() })}
        </Text>
      ) : (
        <View className="gap-2">
          <ListGroup>
            {results.map((module) => (
              <ListRow
                key={module.id}
                icon={moduleIcon(module.id)}
                title={t(`${module.id}.name`)}
                detail={t(`${module.id}.description`)}
                onPress={() => {
                  close()
                  go(module.route)
                }}
              />
            ))}
          </ListGroup>
          <Text className="text-sm text-muted-foreground">
            {t("search.contentSoon")}
          </Text>
        </View>
      )}
    </Sheet>
  )
}
