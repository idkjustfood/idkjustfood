import { Tabs } from "expo-router/js-tabs"

import { AppNavigation } from "@/components/app-navigation"
import { useIsWide } from "@/lib/layout"

export default function TabsLayout() {
  const wide = useIsWide()
  return (
    <Tabs
      tabBar={(props) => <AppNavigation {...props} wide={wide} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? "left" : "bottom",
      }}
    >
      <Tabs.Screen name="(recipes)" options={{ title: "Recipes" }} />
      <Tabs.Screen name="shopping" options={{ title: "Shopping" }} />
      <Tabs.Screen name="add" options={{ title: "Add a recipe" }} />
      <Tabs.Screen name="planner" options={{ title: "Planner" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  )
}
