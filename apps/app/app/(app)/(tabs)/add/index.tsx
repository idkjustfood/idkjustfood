import { router } from "expo-router"
import { ChevronRight, Share2 } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { Grid } from "@/components/grid"
import { Screen } from "@/components/screen"
import { Icon } from "@/components/ui/icon"
import { addMethods, type AddMethod } from "@/lib/add-methods"

export default function ChooseMethod() {
  const { t } = useTranslation()
  const methods = Object.entries(addMethods) as [
    AddMethod,
    (typeof addMethods)[AddMethod],
  ][]

  return (
    <Screen
      title={t("add:index.title")}
      subtitle={t("add:index.subtitle")}
    >
      <Grid
        items={methods}
        keyOf={([key]) => key}
        render={([key, method]) => (
          <Pressable
            role="link"
            onPress={() => router.push(`/add/${key}`)}
            className="min-h-20 flex-1 flex-row items-center gap-4 rounded-lg border border-border bg-card p-4 active:opacity-80 web:hover:border-ring"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Icon as={method.icon} size={24} className="text-primary" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold text-foreground">
                {t(method.titleKey)}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {t(method.descriptionKey)}
              </Text>
            </View>
            <Icon as={ChevronRight} className="text-muted-foreground" />
          </Pressable>
        )}
      />
      <View className="flex-row gap-3 rounded-lg bg-muted p-4">
        <Icon as={Share2} className="text-muted-foreground" />
        <Text className="flex-1 text-muted-foreground">
          {t("add:index.shareTip")}
        </Text>
      </View>
    </Screen>
  )
}
