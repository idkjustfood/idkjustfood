import { Pressable, Text, View } from "react-native"

import { cn } from "@/lib/utils"

type Option<T extends string> = { value: T; label: string }

/** A row of options where exactly one is selected, like "Metric | Imperial". */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name of the group. */
  label: string
  className?: string
}) {
  return (
    <View
      role="radiogroup"
      accessibilityLabel={label}
      className={cn("flex-row rounded-md bg-muted p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            className={cn(
              "h-10 flex-1 items-center justify-center rounded-sm px-2",
              selected && "bg-background shadow-sm"
            )}
          >
            <Text
              numberOfLines={1}
              className={cn(
                "text-sm font-medium",
                selected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
