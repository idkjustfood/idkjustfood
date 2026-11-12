import { CircleAlert, type LucideIcon } from "lucide-react-native"
import { ActivityIndicator, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/** Grey placeholder blocks shown while a list loads. */
export function LoadingState({
  label,
  rows = 3,
}: {
  label: string
  rows?: number
}) {
  return (
    <View role="progressbar" aria-label={label} aria-busy className="gap-4">
      <View className="flex-row items-center gap-2">
        <ActivityIndicator />
        <Text className="text-muted-foreground">{label}</Text>
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
      ))}
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
  className,
}: {
  icon: LucideIcon
  title: string
  message: string
  action?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <View
      className={cn(
        "items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12",
        className
      )}
    >
      <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon as={icon} size={28} className="text-muted-foreground" />
      </View>
      <Text
        role="heading"
        className="text-center text-lg font-semibold text-foreground"
      >
        {title}
      </Text>
      <Text className="max-w-sm text-center text-muted-foreground">
        {message}
      </Text>
      {action && onAction && (
        <Button label={action} onPress={onAction} className="mt-2" />
      )}
    </View>
  )
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <View
      role="alert"
      className="items-center gap-3 rounded-lg border border-destructive/40 px-6 py-12"
    >
      <Icon as={CircleAlert} size={32} className="text-destructive" />
      <Text className="text-center text-lg font-semibold text-foreground">
        {title}
      </Text>
      <Text className="max-w-sm text-center text-muted-foreground">
        {message}
      </Text>
      {onRetry && (
        <Button
          variant="outline"
          label="Try again"
          onPress={onRetry}
          className="mt-2"
        />
      )}
    </View>
  )
}
