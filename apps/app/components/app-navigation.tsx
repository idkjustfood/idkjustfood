import type { BottomTabBarProps } from "expo-router/js-tabs"
import {
  BookOpen,
  CalendarDays,
  Plus,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react-native"
import { Pressable, Text, View } from "react-native"

import { SpaceSwitcher } from "@/components/space-switcher"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

const tabs: Record<string, { label: string; icon: LucideIcon }> = {
  "(recipes)": { label: "Recipes", icon: BookOpen },
  shopping: { label: "Shopping", icon: ShoppingCart },
  add: { label: "Add", icon: Plus },
  planner: { label: "Planner", icon: CalendarDays },
  settings: { label: "Settings", icon: Settings },
}

type Props = BottomTabBarProps & { wide: boolean }

/** Bottom tab bar on phones, side bar on tablets and desktops. */
export function AppNavigation({ wide, ...props }: Props) {
  return wide ? <SideBar {...props} /> : <BottomBar {...props} />
}

function usePress({ state, emitter, navigateToTab }: BottomTabBarProps) {
  return (routeKey: string) => {
    const focused = state.routes[state.index]?.key === routeKey
    const event = emitter.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    })
    if (!focused && !event.defaultPrevented) navigateToTab(routeKey)
  }
}

function BottomBar(props: BottomTabBarProps) {
  const { state, insets } = props
  const press = usePress(props)

  return (
    <View
      role="tablist"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className="flex-row border-t border-border bg-background px-2 pt-2"
    >
      {state.routes.map((route, index) => {
        const tab = tabs[route.name]
        if (!tab) return null
        const focused = index === state.index

        if (route.name === "add") {
          return (
            <Pressable
              key={route.key}
              role="tab"
              aria-selected={focused}
              accessibilityLabel="Add a recipe"
              onPress={() => press(route.key)}
              className="flex-1 items-center justify-center"
            >
              <View className="h-12 w-14 items-center justify-center rounded-2xl bg-primary active:opacity-80">
                <Icon
                  as={tab.icon}
                  size={26}
                  className="text-primary-foreground"
                />
              </View>
            </Pressable>
          )
        }

        return (
          <Pressable
            key={route.key}
            role="tab"
            aria-selected={focused}
            onPress={() => press(route.key)}
            className="min-h-12 flex-1 items-center justify-center gap-1"
          >
            <Icon
              as={tab.icon}
              size={22}
              className={focused ? "text-primary" : "text-muted-foreground"}
            />
            <Text
              className={cn(
                "text-xs font-medium",
                focused ? "text-primary" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function SideBar(props: BottomTabBarProps) {
  const { state, insets } = props
  const press = usePress(props)
  const add = state.routes.find((r) => r.name === "add")

  return (
    <View
      role="navigation"
      style={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingLeft: insets.left + 12,
        paddingRight: 12,
      }}
      className="w-60 gap-6 border-r border-border bg-background lg:w-64"
    >
      <Text className="px-3 text-xl font-bold text-foreground">
        idkjustfood
      </Text>
      <SpaceSwitcher compact />
      {add && (
        <Pressable
          role="button"
          onPress={() => press(add.key)}
          className="h-12 flex-row items-center gap-3 rounded-md bg-primary px-3 active:opacity-80 web:hover:opacity-90"
        >
          <Icon as={Plus} className="text-primary-foreground" />
          <Text className="text-base font-medium text-primary-foreground">
            Add recipe
          </Text>
        </Pressable>
      )}
      <View role="tablist" className="gap-1">
        {state.routes.map((route, index) => {
          const tab = tabs[route.name]
          if (!tab || route.name === "add") return null
          const focused = index === state.index
          return (
            <Pressable
              key={route.key}
              role="tab"
              aria-selected={focused}
              onPress={() => press(route.key)}
              className={cn(
                "h-12 flex-row items-center gap-3 rounded-md px-3 web:hover:bg-accent",
                focused && "bg-secondary"
              )}
            >
              <Icon
                as={tab.icon}
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
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
