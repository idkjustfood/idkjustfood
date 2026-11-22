import { Text, View } from "react-native"

import { cn } from "@/lib/utils"

/**
 * A bar that fills from the left. `share` is 0 to 1 (more than 1 fills the bar). The state is
 * always said in words next to the bar too, so colour is never the only sign.
 */
export function ProgressBar({
  share,
  tone = "primary",
  label,
}: {
  share: number
  tone?: "primary" | "warning" | "danger"
  /** What a screen reader says, for example "75 percent". */
  label: string
}) {
  const width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%` as const
  return (
    <View
      role="progressbar"
      accessibilityLabel={label}
      className="h-3 overflow-hidden rounded-full bg-muted"
    >
      <View
        style={{ width }}
        className={cn(
          "h-full rounded-full",
          tone === "primary" && "bg-primary",
          tone === "warning" && "bg-tone-butter-foreground",
          tone === "danger" && "bg-destructive"
        )}
      />
    </View>
  )
}

/** A short word in a rounded tag, for example "Over budget". */
export function StateTag({
  label,
  tone,
}: {
  label: string
  tone: "ok" | "warning" | "danger"
}) {
  return (
    <View
      className={cn(
        "self-start rounded-full px-2.5 py-0.5",
        tone === "ok" && "bg-tone-sage",
        tone === "warning" && "bg-tone-butter",
        tone === "danger" && "bg-destructive"
      )}
    >
      <Text
        className={cn(
          "text-xs font-medium",
          tone === "ok" && "text-tone-sage-foreground",
          tone === "warning" && "text-tone-butter-foreground",
          tone === "danger" && "text-primary-foreground"
        )}
      >
        {label}
      </Text>
    </View>
  )
}
