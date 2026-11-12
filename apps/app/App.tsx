import "./global.css"
import { StatusBar } from "expo-status-bar"
import { Text, View } from "react-native"
import { Button } from "@/components/ui/button"

export default function App() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background">
      <Text className="text-xl font-semibold text-foreground">idkjustfood</Text>
      <Button label="Styled with Tailwind" />
      <StatusBar style="auto" />
    </View>
  )
}
