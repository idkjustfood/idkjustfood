import { router, usePathname, type Href } from "expo-router"
import type { BottomTabBarProps } from "expo-router/js-tabs"
import { Plus, Search } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text, View } from "react-native"

import { SpaceSwitcher } from "@/components/space-switcher"
import { Icon } from "@/components/ui/icon"
import { useAppState } from "@/lib/app-state"
import { areaIcons, moduleIcon } from "@/lib/module-icons"
import {
  areaOfRoute,
  areas,
  modulesInArea,
  type Area,
  type ModuleArea,
} from "@/lib/modules"
import { useShell } from "@/lib/shell"
import { cn } from "@/lib/utils"

/** The route name of each bottom tab. The Today screen is the app's start page, "index". */
const tabRoute: Record<Area, string> = {
  today: "index",
  plan: "plan",
  home: "home",
  food: "food",
  money: "money",
  more: "more",
}

type Props = BottomTabBarProps & { wide: boolean }

/** Bottom tab bar on phones, side bar on tablets and desktops. */
export function AppNavigation({ wide, ...props }: Props) {
  return wide ? <SideBar {...props} /> : <BottomBar {...props} />
}

/** The area of the screen being shown, so its tab stays highlighted inside a module. */
function useActiveArea({ state }: BottomTabBarProps): Area | null {
  const route = state.routes[state.index]
  return route
    ? areaOfRoute(route.name, route.params as Record<string, unknown>)
    : null
}

function usePress({ state, emitter, navigateToTab }: BottomTabBarProps) {
  return (area: Area) => {
    const route = state.routes.find((r) => r.name === tabRoute[area])
    if (!route) return
    const focused = state.routes[state.index]?.key === route.key
    const event = emitter.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    })
    if (!focused && !event.defaultPrevented) navigateToTab(route.key)
  }
}

function BottomBar(props: BottomTabBarProps) {
  const { t } = useTranslation("modules")
  const { insets } = props
  const press = usePress(props)
  const active = useActiveArea(props)
  const { setQuickAddOpen } = useShell()

  const tab = (area: Area) => {
    const focused = area === active
    return (
      <Pressable
        key={area}
        role="tab"
        aria-selected={focused}
        onPress={() => press(area)}
        className="min-h-12 flex-1 items-center justify-center gap-1"
      >
        <Icon
          as={areaIcons[area]}
          size={22}
          className={focused ? "text-primary" : "text-muted-foreground"}
        />
        <Text
          numberOfLines={1}
          className={cn(
            "text-xs font-medium",
            focused ? "text-primary" : "text-muted-foreground"
          )}
        >
          {t(`areas.${area}`)}
        </Text>
      </Pressable>
    )
  }

  return (
    <View
      role="tablist"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className="flex-row border-t border-border bg-background px-2 pt-2"
    >
      {tab("today")}
      {tab("plan")}
      {tab("home")}
      {/* The quick-add button is not a tab: it opens a sheet. */}
      <View className="flex-1 items-center justify-center">
        <Pressable
          role="button"
          accessibilityLabel={t("quickAdd.open")}
          onPress={() => setQuickAddOpen(true)}
          className="h-12 w-14 items-center justify-center rounded-2xl bg-primary active:opacity-80"
        >
          <Icon as={Plus} size={26} className="text-primary-foreground" />
        </Pressable>
      </View>
      {tab("food")}
      {tab("money")}
      {tab("more")}
    </View>
  )
}

function SideBar(props: BottomTabBarProps) {
  const { t } = useTranslation("modules")
  const { insets } = props
  const press = usePress(props)
  const active = useActiveArea(props)
  const pathname = usePathname()
  const { disabledModules } = useAppState()
  const { setQuickAddOpen, setSearchOpen } = useShell()

  return (
    <View
      role="navigation"
      style={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingLeft: insets.left + 12,
        paddingRight: 12,
      }}
      className="w-60 gap-4 border-r border-border bg-background lg:w-64"
    >
      <Text className="px-3 text-xl font-bold text-foreground">
        idkjustfood
      </Text>
      <SpaceSwitcher />
      <Pressable
        role="button"
        onPress={() => setQuickAddOpen(true)}
        className="h-12 flex-row items-center gap-3 rounded-md bg-primary px-3 active:opacity-80 web:hover:opacity-90"
      >
        <Icon as={Plus} className="text-primary-foreground" />
        <Text className="text-base font-medium text-primary-foreground">
          {t("quickAdd.button")}
        </Text>
      </Pressable>
      <Pressable
        role="button"
        accessibilityLabel={t("search.open")}
        onPress={() => setSearchOpen(true)}
        className="h-10 flex-row items-center gap-3 rounded-md border border-border px-3 active:bg-accent web:hover:bg-accent"
      >
        <Icon as={Search} size={18} className="text-muted-foreground" />
        <Text className="flex-1 text-sm text-muted-foreground">
          {t("search.sidebar")}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {t("search.shortcut")}
        </Text>
      </Pressable>
      <ScrollView role="tablist" contentContainerClassName="gap-4">
        {areas.map((area) => {
          const focused = area === active
          const items =
            area === "today" ? [] : modulesInArea(area as ModuleArea, disabledModules)
          return (
            <View key={area} className="gap-1">
              <Pressable
                role="tab"
                aria-selected={focused}
                onPress={() => press(area)}
                className={cn(
                  "h-11 flex-row items-center gap-3 rounded-md px-3 web:hover:bg-accent",
                  focused && "bg-secondary"
                )}
              >
                <Icon
                  as={areaIcons[area]}
                  className={focused ? "text-primary" : "text-muted-foreground"}
                />
                <Text
                  className={cn(
                    "text-base",
                    focused
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {t(`areas.${area}`)}
                </Text>
              </Pressable>
              {items.map((module) => {
                const here = pathname === module.route
                return (
                  <Pressable
                    key={module.id}
                    role="link"
                    aria-current={here ? "page" : undefined}
                    onPress={() => router.push(module.route as Href)}
                    className={cn(
                      "h-9 flex-row items-center gap-3 rounded-md pl-6 pr-3 web:hover:bg-accent",
                      here && "bg-accent"
                    )}
                  >
                    <Icon
                      as={moduleIcon(module.id)}
                      size={16}
                      className={here ? "text-primary" : "text-muted-foreground"}
                    />
                    <Text
                      numberOfLines={1}
                      className={cn(
                        "flex-1 text-sm",
                        here
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t(`${module.id}.name`)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
