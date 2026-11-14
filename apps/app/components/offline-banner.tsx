import { CloudOff } from "lucide-react-native"
import { Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { useShoppingState } from "@/lib/shopping"

/** Tells the user they can keep using lists without a connection, and what is waiting to be sent. */
export function OfflineBanner() {
  const { online, pending } = useShoppingState()
  if (online) return null
  return (
    <View
      role="status"
      className="flex-row items-start gap-3 rounded-lg bg-amber-100 p-3 dark:bg-amber-950"
    >
      <Icon as={CloudOff} className="text-amber-700 dark:text-amber-300" />
      <View className="flex-1">
        <Text className="font-semibold text-amber-900 dark:text-amber-100">
          You are offline
        </Text>
        <Text className="text-amber-900 dark:text-amber-200">
          You can keep ticking things off. Changes sync when you are back
          online.
          {pending > 0
            ? ` ${pending} ${pending === 1 ? "change is" : "changes are"} waiting.`
            : ""}
        </Text>
      </View>
    </View>
  )
}
