import { Check } from "lucide-react-native"
import { View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/** The visual box only. Put it inside a Pressable row that has role="checkbox". */
export function CheckboxBox({
  checked,
  className,
}: {
  checked: boolean
  className?: string
}) {
  return (
    <View
      className={cn(
        "h-6 w-6 items-center justify-center rounded-md border-2",
        checked ? "border-primary bg-primary" : "border-input bg-background",
        className
      )}
    >
      {checked && (
        <Icon
          as={Check}
          size={16}
          strokeWidth={3}
          className="text-primary-foreground"
        />
      )}
    </View>
  )
}
