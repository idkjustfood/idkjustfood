import * as React from "react"
import { Pressable, Text } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-md px-4 py-2 active:opacity-80",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        outline: "border border-input bg-background",
        destructive: "bg-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const textVariants = cva("text-sm font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      destructive: "text-primary-foreground",
    },
  },
  defaultVariants: { variant: "default" },
})

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & { label: string }

export function Button({ label, variant, className, ...props }: ButtonProps) {
  return (
    <Pressable
      role="button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    >
      <Text className={textVariants({ variant })}>{label}</Text>
    </Pressable>
  )
}
