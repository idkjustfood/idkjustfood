import { Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export default function Home() {
  const { data: session } = authClient.useSession()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-between p-6">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-foreground">
            idkjustfood
          </Text>
          <Text className="text-base text-muted-foreground">
            Signed in as {session?.user.name ?? session?.user.email}
          </Text>
        </View>
        <Button
          variant="outline"
          label="Log out"
          className="h-12"
          onPress={() => authClient.signOut()}
        />
      </View>
    </SafeAreaView>
  )
}
