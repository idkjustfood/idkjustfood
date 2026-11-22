import { Tabs } from "expo-router/js-tabs"

import { AppNavigation } from "@/components/app-navigation"
import { ShellSheets } from "@/components/shell-sheets"
import { useIsWide } from "@/lib/layout"
import { ShellProvider } from "@/lib/shell"

/**
 * Six areas: Today, Plan, Home, Food, Money, More. The other screens in this folder (recipes,
 * shopping, planner, settings, add, module placeholders) are tabs too, so the bar stays in
 * place, but the navigation only shows the six areas.
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
      >
        {/* Expo Router renders only declared screens, so every route in this folder is listed. */}
        <Tabs.Screen name="index" />
        <Tabs.Screen name="plan" />
        <Tabs.Screen name="home" />
        <Tabs.Screen name="food" />
        <Tabs.Screen name="money" />
        <Tabs.Screen name="more" />
        <Tabs.Screen name="(recipes)" />
        <Tabs.Screen name="shopping" />
        <Tabs.Screen name="add" />
        <Tabs.Screen name="planner" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="chores" />
        <Tabs.Screen name="maintenance" />
        <Tabs.Screen name="plants" />
        <Tabs.Screen name="pets" />
        <Tabs.Screen name="inventory" />
        <Tabs.Screen name="contacts" />
        <Tabs.Screen name="documents" />
        <Tabs.Screen name="expenses" />
        <Tabs.Screen name="budget" />
        <Tabs.Screen name="bills" />
        <Tabs.Screen name="savings" />
        <Tabs.Screen name="settings" />
        <Tabs.Screen name="m/[id]" />
      </Tabs>
      <ShellSheets />
    </ShellProvider>
  )
}
