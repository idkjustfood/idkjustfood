import { CloudOff } from "lucide-react-native"
import { Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { useAppState } from "@/lib/app-state"

/** Tells the user they can keep using lists without a connection. */
export function OfflineBanner() {
  const { offline } = useAppState()
  if (!offline) return null
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
        </Text>
      </View>
    </View>
  )
}
