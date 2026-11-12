import type { LucideIcon, LucideProps } from "lucide-react-native"
import { cssInterop } from "nativewind"

import { cn } from "@/lib/utils"

type IconProps = LucideProps & { as: LucideIcon }

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />
}

// Lets icons take their colour and size from Tailwind classes (text-*, size-*).
cssInterop(IconImpl, {
  className: {
    target: "style",
    nativeStyleToProp: { height: "size", width: "size" },
  },
})

/** A Lucide icon styled with classes, for example `<Icon as={Search} className="text-muted-foreground" />`. */
export function Icon({ as, className, size = 20, ...props }: IconProps) {
  return (
    <IconImpl
      as={as}
      className={cn("text-foreground", className)}
      size={size}
      {...props}
    />
  )
}
