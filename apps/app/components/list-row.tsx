import { ChevronRight, type LucideIcon } from "lucide-react-native"
import { Children, type ReactNode } from "react"
import { Pressable, Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/** One row in a grouped list, like on a settings screen. Tappable when `onPress` is set. */
export function ListRow({
  icon,
  title,
  detail,
  right,
  onPress,
  destructive,
}: {
  icon?: LucideIcon
  title: string
  detail?: string
  right?: ReactNode
  onPress?: () => void
  destructive?: boolean
}) {
  const body = (
    <>
      {icon && (
        <Icon
          as={icon}
          className={destructive ? "text-destructive" : "text-muted-foreground"}
        />
      )}
      <View className="flex-1 gap-0.5">
        <Text
          className={cn(
            "text-base",
            destructive ? "text-destructive" : "text-foreground"
          )}
        >
          {title}
        </Text>
        {detail && (
          <Text className="text-sm text-muted-foreground">{detail}</Text>
        )}
      </View>
      {right}
      {onPress && !right && (
        <Icon as={ChevronRight} className="text-muted-foreground" />
      )}
    </>
  )

  const className = "min-h-14 flex-row items-center gap-3 px-4 py-3"
  if (!onPress) return <View className={className}>{body}</View>
  return (
    <Pressable
      role="button"
      onPress={onPress}
      className={cn(className, "active:bg-accent web:hover:bg-accent")}
    >
      {body}
    </Pressable>
  )
}

/** A titled group of rows with dividers. */
export function ListGroup({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <View className="gap-2">
      {title && (
        <Text className="px-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
      )}
      <View className="overflow-hidden rounded-lg border border-border bg-card">
        {Children.toArray(children)
          .filter(Boolean)
          .map((child, i) => (
            <View key={i} className={cn(i > 0 && "border-t border-border")}>
              {child}
            </View>
          ))}
      </View>
    </View>
  )
}
