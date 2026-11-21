import { CircleAlert, type LucideIcon } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { useTheme } from "@/lib/theme"
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
  const { headingStyle, cardStyle } = useTheme()
  return (
    <View
      style={cardStyle}
      className={cn(
        "items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12",
        className
      )}
    >
      <View className="h-20 w-20 items-center justify-center rounded-full bg-tone-peach">
        <Icon as={icon} size={34} className="text-tone-peach-foreground" />
      </View>
      <Text
        role="heading"
        style={headingStyle}
        className="text-center text-xl font-semibold text-foreground"
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
  const { t } = useTranslation("common")
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
          label={t("tryAgain")}
          onPress={onRetry}
          className="mt-2"
        />
      )}
    </View>
  )
}
