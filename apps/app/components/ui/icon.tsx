import type { LucideIcon, LucideProps } from "lucide-react-native"
import { cssInterop } from "nativewind"

import { cozyIcon } from "@/components/ui/cozy-icons"
import { useTheme } from "@/lib/theme"
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

/**
 * An icon styled with classes, for example `<Icon as={Search} className="text-muted-foreground" />`.
 * Pass the Lucide icon; with a theme that uses the cozy icon style it is drawn as
 * the matching hand-drawn icon instead.
 */
export function Icon({ as, className, size = 20, ...props }: IconProps) {
  const { theme } = useTheme()
  return (
    <IconImpl
      as={theme.icons === "cozy" ? cozyIcon(as) : as}
      className={cn("text-foreground", className)}
      size={size}
      {...props}
    />
  )
}
