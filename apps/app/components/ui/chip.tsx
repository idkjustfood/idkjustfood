import { Pressable, Text } from "react-native"

import { cn } from "@/lib/utils"

/** A small toggle, for example a tag filter. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable
      role="checkbox"
      aria-checked={!!selected}
      onPress={onPress}
      className={cn(
        "h-10 justify-center rounded-full border px-4 active:opacity-80",
        selected
          ? "border-primary bg-primary"
          : "border-border bg-background web:hover:bg-accent"
      )}
    >
      <Text
        className={cn(
          "text-sm font-medium",
          selected ? "text-primary-foreground" : "text-foreground"
        )}
      >
        {label}
      </Text>
    </Pressable>
  )
}
