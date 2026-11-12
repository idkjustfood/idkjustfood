import * as React from "react"
import { Pressable, Text } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import type { LucideIcon } from "lucide-react-native"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-md px-4 py-2 active:opacity-80 web:hover:opacity-90",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        outline: "border border-input bg-background",
        ghost: "bg-transparent web:hover:bg-accent",
        destructive: "bg-destructive",
      },
      size: {
        default: "h-12",
        sm: "h-10 px-3",
        lg: "h-14 px-6",
        icon: "h-12 w-12 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

const textVariants = cva("font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      ghost: "text-foreground",
      destructive: "text-primary-foreground",
    },
    size: {
      default: "text-base",
      sm: "text-sm",
      lg: "text-lg",
      icon: "text-base",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
})

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    /** Visible text. With size "icon" it becomes the accessible name only. */
    label: string
    icon?: LucideIcon
  }

export function Button({
  label,
  variant,
  size,
  icon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      className={cn(
        buttonVariants({ variant, size }),
        disabled && "opacity-50",
        className
      )}
      {...props}
    >
      {icon && (
        <Icon
          as={icon}
          size={size === "lg" ? 22 : 20}
          className={textVariants({ variant })}
        />
      )}
      {size !== "icon" && (
        <Text className={textVariants({ variant, size })}>{label}</Text>
      )}
    </Pressable>
  )
}
