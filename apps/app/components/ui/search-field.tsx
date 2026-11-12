import { Search, X } from "lucide-react-native"
import { Pressable, TextInput, View } from "react-native"

import { Icon } from "@/components/ui/icon"

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
}) {
  return (
    <View className="h-12 flex-row items-center gap-2 rounded-md border border-input bg-background pl-3">
      <Icon as={Search} className="text-muted-foreground" />
      <TextInput
        role="searchbox"
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#737373"
        returnKeyType="search"
        className="h-full min-w-0 flex-1 text-base text-foreground web:outline-none"
      />
      {value.length > 0 && (
        <Pressable
          role="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText("")}
          className="h-12 w-12 items-center justify-center"
        >
          <Icon as={X} className="text-muted-foreground" />
        </Pressable>
      )}
    </View>
  )
}
