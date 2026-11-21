import { Tabs } from "expo-router/js-tabs"

import { AppNavigation } from "@/components/app-navigation"
import { ShellSheets } from "@/components/shell-sheets"
import { useIsWide } from "@/lib/layout"
import { ShellProvider } from "@/lib/shell"

/**
 * Five areas: Today, Plan, Food, Money, More. The other screens in this folder (recipes,
 * shopping, planner, settings, add, module placeholders) are tabs too, so the bar stays in
 * place, but the navigation only shows the five areas.
 */
export default function TabsLayout() {
  const wide = useIsWide()
  return (
    <ShellProvider>
      <Tabs
        tabBar={(props) => <AppNavigation {...props} wide={wide} />}
        screenOptions={{
          headerShown: false,
          tabBarPosition: wide ? "left" : "bottom",
        }}
      />
      <ShellSheets />
    </ShellProvider>
  )
}
