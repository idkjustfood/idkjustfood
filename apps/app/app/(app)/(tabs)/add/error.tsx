import { router, useLocalSearchParams } from "expo-router"
import { CircleAlert } from "lucide-react-native"
import { Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"

const messages = {
  unsupported: {
    title: "This link is not supported yet",
    message:
      "For now idkjustfood reads Instagram reels. YouTube Shorts and TikTok are coming later. You can still paste the recipe text or add a screenshot.",
  },
  failed: {
    title: "We could not read this recipe",
    message:
      "Something went wrong while reading the recipe. Try again, or paste the recipe text instead.",
  },
}

export default function AddError() {
  const { reason, link } = useLocalSearchParams<{
    reason?: string
    link?: string
  }>()
  const content =
    reason === "unsupported" ? messages.unsupported : messages.failed

  return (
    <Screen title="Could not add recipe" back="/add" narrow>
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
          label="Paste the text instead"
          onPress={() => router.replace("/add/text")}
        />
        <Button
          variant="outline"
          label="Use a photo or screenshot"
          onPress={() => router.replace("/add/photo")}
        />
        <Button
          variant="ghost"
          label="Back to all options"
          onPress={() => router.replace("/add")}
        />
      </View>
    </Screen>
  )
}
