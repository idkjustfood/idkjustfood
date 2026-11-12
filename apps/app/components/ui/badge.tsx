import { Text, View } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "flex-row items-center self-start rounded-full px-2.5 py-1",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        outline: "border border-border",
        warning: "bg-amber-100 dark:bg-amber-950",
      },
    },
    defaultVariants: { variant: "secondary" },
  }
)

const badgeText = cva("text-xs font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      warning: "text-amber-900 dark:text-amber-200",
    },
  },
  defaultVariants: { variant: "secondary" },
})

type BadgeProps = VariantProps<typeof badgeVariants> & {
  label: string
  className?: string
}

export function Badge({ label, variant, className }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      <Text className={badgeText({ variant })}>{label}</Text>
    </View>
  )
}
