import * as React from "react"
import { Text, TextInput, View } from "react-native"
import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<typeof TextInput> & {
  label: string
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#737373"
        className={cn(
          "h-12 rounded-md border border-input bg-background px-3 text-base text-foreground",
          className
        )}
        {...props}
      />
    </View>
  )
}
