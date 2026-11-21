import { CloudOff } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { useShoppingState } from "@/lib/shopping"

/** Tells the user they can keep using lists without a connection, and what is waiting to be sent. */
export function OfflineBanner() {
  const { t } = useTranslation("common")
  const { online, pending } = useShoppingState()
  if (online) return null
  return (
    <View
      role="status"
      className="flex-row items-start gap-3 rounded-lg bg-tone-butter p-3"
    >
      <Icon as={CloudOff} className="text-tone-butter-foreground" />
      <View className="flex-1">
        <Text className="font-semibold text-tone-butter-foreground">
          {t("offline.title")}
        </Text>
        <Text className="text-tone-butter-foreground">
          {t("offline.message")}
          {pending > 0 ? ` ${t("offline.pending", { count: pending })}` : ""}
        </Text>
      </View>
    </View>
  )
}
