import { Minus, Plus } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/** A number with minus and plus buttons big enough for a thumb. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  className,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** Accessible name, for example "Servings". */
  label: string
  className?: string
}) {
  const { t } = useTranslation("common")
  return (
    <View
      role="group"
      accessibilityLabel={label}
      className={cn("flex-row items-center", className)}
    >
      <Pressable
        role="button"
        accessibilityLabel={t("stepper.fewer", { label: label.toLowerCase() })}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        className={cn(
          "h-11 w-11 items-center justify-center rounded-md border border-input active:bg-accent",
          value <= min && "opacity-40"
        )}
      >
        <Icon as={Minus} size={18} />
      </Pressable>
      <Text
        accessibilityLabel={`${value} ${label.toLowerCase()}`}
        className="min-w-10 text-center text-base font-semibold text-foreground"
      >
        {value}
      </Text>
      <Pressable
        role="button"
        accessibilityLabel={t("stepper.more", { label: label.toLowerCase() })}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        className={cn(
          "h-11 w-11 items-center justify-center rounded-md border border-input active:bg-accent",
          value >= max && "opacity-40"
        )}
      >
        <Icon as={Plus} size={18} />
      </Pressable>
    </View>
  )
}
