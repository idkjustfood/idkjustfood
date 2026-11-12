import { Sparkles } from "lucide-react-native"
import { Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"

/** Marks a screen or section as a preview of a feature that is not built yet. */
export function ComingSoon({ message }: { message: string }) {
  return (
    <View
      role="note"
      className="flex-row items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4"
    >
      <Icon as={Sparkles} className="mt-0.5 text-primary" />
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-foreground">Coming soon</Text>
        <Text className="text-muted-foreground">{message}</Text>
      </View>
    </View>
  )
}
