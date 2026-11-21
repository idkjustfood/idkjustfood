import { Check, ChevronDown } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type Option<T extends string> = { value: T; label: string }

/**
 * A dropdown: a field showing the chosen option that opens a list to pick from.
 * On phones the list is a bottom sheet, which is easier to use with one hand.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  /** Accessible name of the field and title of the list. */
  label: string
  className?: string
}) {
  const { t } = useTranslation("common")
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.value === value)

  return (
    <>
      <Pressable
        role="combobox"
        accessibilityLabel={label}
        aria-expanded={open}
        onPress={() => setOpen(true)}
        className={cn(
          "h-12 flex-row items-center justify-between gap-2 rounded-md border border-input bg-background px-3",
          className
        )}
      >
        <Text numberOfLines={1} className="flex-1 text-base text-foreground">
          {current?.label}
        </Text>
        <Icon as={ChevronDown} size={18} className="text-muted-foreground" />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView className="max-h-96">
          {options.map((option) => {
            const selected = option.value === value
            return (
              <Pressable
                key={option.value}
                role="option"
                aria-selected={selected}
                onPress={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className="min-h-14 flex-row items-center justify-between gap-3 rounded-md px-3 active:bg-accent web:hover:bg-accent"
              >
                <Text className="flex-1 text-base text-foreground">
                  {option.label}
                </Text>
                {selected && <Icon as={Check} className="text-primary" />}
              </Pressable>
            )
          })}
        </ScrollView>
      </Sheet>
    </>
  )
}
