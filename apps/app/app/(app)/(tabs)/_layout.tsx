import { Tabs } from "expo-router/js-tabs"
import { useTranslation } from "react-i18next"

import { AppNavigation } from "@/components/app-navigation"
import { useIsWide } from "@/lib/layout"

export default function TabsLayout() {
  const { t } = useTranslation("common")
  const wide = useIsWide()
  return (
    <Tabs
      tabBar={(props) => <AppNavigation {...props} wide={wide} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? "left" : "bottom",
      }}
    >
      <Tabs.Screen name="(recipes)" options={{ title: t("tabs.recipes") }} />
      <Tabs.Screen name="shopping" options={{ title: t("tabs.shopping") }} />
      <Tabs.Screen name="add" options={{ title: t("tabs.addRecipe") }} />
      <Tabs.Screen name="planner" options={{ title: t("tabs.planner") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings") }} />
    </Tabs>
  )
}
