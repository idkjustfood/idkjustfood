import * as React from "react"
import { Text, View } from "react-native"

import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function Card({
  className,
  ...props
}: React.ComponentProps<typeof View>) {
  const { cardStyle } = useTheme()
  return (
    <View
      className={cn("rounded-lg border border-border bg-card", className)}
      {...props}
      style={[cardStyle, props.style]}
    />
  )
}

export function CardTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { headingStyle } = useTheme()
  return (
    <Text
      role="heading"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
      style={[headingStyle, props.style]}
    />
  )
}

/** A small heading above a group of content, like "Ingredients". */
export function SectionTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { headingStyle } = useTheme()
  return (
    <Text
      role="heading"
      className={cn("text-xl font-semibold text-foreground", className)}
      {...props}
      style={[headingStyle, props.style]}
    />
  )
}
