import { router, useLocalSearchParams } from "expo-router"
import { CircleAlert } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { extractionErrorMessage } from "@/lib/extractions"

export default function AddError() {
  const { t } = useTranslation()
  const { reason, link, code } = useLocalSearchParams<{
    reason?: string
    link?: string
    code?: string
  }>()
  const unsupported = reason === "unsupported"
  // The server sends a code for what went wrong (private video, no AI key, ...): show
  // the matching translated text.
  const content = {
    title: unsupported
      ? t("add:error.unsupportedTitle")
      : t("add:error.failedTitle"),
    message: code
      ? extractionErrorMessage(code)
      : unsupported
        ? t("add:error.unsupportedMessage")
        : t("add:error.failedMessage"),
  }

  return (
    <Screen title={t("add:error.title")} back="/add" narrow>
      <View role="alert" className="items-center gap-4 py-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <Icon as={CircleAlert} size={40} className="text-destructive" />
        </View>
        <Text className="text-center text-xl font-semibold text-foreground">
          {content.title}
        </Text>
        <Text className="max-w-md text-center text-base text-muted-foreground">
          {content.message}
        </Text>
        {link && (
          <Text
            numberOfLines={1}
            className="max-w-full rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            {link}
          </Text>
        )}
      </View>
      <View className="gap-3">
        <Button
          label={t("add:error.pasteText")}
          onPress={() => router.replace("/add/text")}
        />
        <Button
          variant="outline"
          label={t("add:error.usePhoto")}
          onPress={() => router.replace("/add/photo")}
        />
        <Button
          variant="ghost"
          label={t("add:error.backToOptions")}
          onPress={() => router.replace("/add")}
        />
      </View>
    </Screen>
  )
}
