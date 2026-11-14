import { Pressable, Text, View } from "react-native"
import { isTagKey, type TagKey } from "@workspace/schemas"

import { tagColors, tagName } from "@/lib/tags"
import { cn } from "@/lib/utils"

/** A tag in the color of its group, in the current language. */
export function TagBadge({ tag, className }: { tag: TagKey; className?: string }) {
  // Not on the list (for example old data before the migration ran): show nothing.
  if (!isTagKey(tag)) return null
  const colors = tagColors(tag)
  return (
    <View
      className={cn(
        "flex-row items-center self-start rounded-full border px-2.5 py-1",
        colors.soft,
        className
      )}
    >
      <Text className={cn("text-xs font-medium", colors.softText)}>
        {tagName(tag)}
      </Text>
    </View>
  )
}

/**
 * A tag that can be switched on and off (a filter, or the choice in the recipe
 * form). Colored by its group: quiet when off, filled when on.
 */
export function TagChip({
  tag,
  selected,
  onPress,
}: {
  tag: TagKey
  selected: boolean
  onPress: () => void
}) {
  if (!isTagKey(tag)) return null
  const colors = tagColors(tag)
  return (
    <Pressable
      role="checkbox"
      aria-checked={selected}
      onPress={onPress}
      className={cn(
        "h-10 justify-center rounded-full border px-4 active:opacity-80",
        selected ? colors.strong : colors.soft
      )}
    >
      <Text
        className={cn(
          "text-sm font-medium",
          selected ? colors.strongText : colors.softText
        )}
      >
        {tagName(tag)}
      </Text>
    </Pressable>
  )
}
