import { Check, ChevronDown } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text } from "react-native"

import { unitKeys, type UnitKey } from "@workspace/schemas"

import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { unitName } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * A dropdown to choose an ingredient's unit from the fixed list. The names are
 * in the current language; the value is the same key in every language.
 * `value` is empty (null) for "no unit".
 */
export function UnitPicker({
  value,
  onChange,
  label,
  className,
}: {
  value: UnitKey | null
  onChange: (value: UnitKey | null) => void
  /** Accessible name and title of the list, for example "Unit". */
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  function choose(unit: UnitKey | null) {
    onChange(unit)
    setOpen(false)
  }

  return (
    <>
      <Pressable
        role="combobox"
        accessibilityLabel={label}
        aria-expanded={open}
        onPress={() => setOpen(true)}
        className={cn(
          "h-12 min-w-0 flex-row items-center justify-between gap-1 rounded-md border border-input bg-background px-3",
          className
        )}
      >
        <Text
          numberOfLines={1}
          className={cn(
            "flex-1 text-base",
            value ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {value ? unitName(value, 1) : label}
        </Text>
        <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView className="max-h-96">
          <Option
            label={t("common:unitPicker.none")}
            selected={value === null}
            onPress={() => choose(null)}
          />
          {unitKeys.map((unit) => (
            <Option
              key={unit}
              label={unitName(unit, 1)}
              selected={value === unit}
              onPress={() => choose(unit)}
            />
          ))}
        </ScrollView>
      </Sheet>
    </>
  )
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      role="option"
      aria-selected={selected}
      onPress={onPress}
      className="h-12 flex-row items-center justify-between border-b border-border px-1"
    >
      <Text
        className={cn(
          "text-base text-foreground",
          selected && "font-semibold"
        )}
      >
        {label}
      </Text>
      {selected && <Icon as={Check} size={18} className="text-primary" />}
    </Pressable>
  )
}
