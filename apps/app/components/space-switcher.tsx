import { Check, ChevronDown, User, Users } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { useHousehold, useHouseholds } from "@/lib/households"
import { cn } from "@/lib/utils"

/**
 * Pick the space to work in: your personal space or one of your households.
 * Recipes, shopping lists and meal plans show only what belongs to it. Opens a
 * bottom sheet on phones, so it works with one hand. Without a household there
 * is nothing to pick, so it is not shown.
 */
export function SpaceSwitcher({ compact }: { compact?: boolean }) {
  const { householdId, setHouseholdId } = useAppState()
  const { households } = useHouseholds()
  // Also falls back to the personal space when the selected household is gone.
  const { household } = useHousehold()
  const [open, setOpen] = useState(false)

  if (households.length === 0) return null

  const current = household?.name ?? "Personal"
  const options = [
    { id: null, name: "Personal", detail: "Only you", icon: User },
    ...households.map((h) => ({
      id: h.id,
      name: h.name,
      detail: "Shared household",
      icon: Users,
    })),
  ]

  function choose(id: string | null) {
    setHouseholdId(id)
    setOpen(false)
  }

  return (
    <>
      <Pressable
        role="button"
        accessibilityLabel={`Space: ${current}. Change`}
        onPress={() => setOpen(true)}
        className={cn(
          "h-11 flex-row items-center gap-2 rounded-md border border-border bg-card px-3 active:bg-accent web:hover:bg-accent",
          compact ? "self-start" : "self-stretch"
        )}
      >
        <Icon
          as={household ? Users : User}
          size={18}
          className="text-muted-foreground"
        />
        <Text
          numberOfLines={1}
          className="flex-1 text-base font-medium text-foreground"
        >
          {current}
        </Text>
        <Icon as={ChevronDown} size={18} className="text-muted-foreground" />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title="Choose a space">
        <View role="radiogroup" aria-label="Space" className="gap-2">
          {options.map((option) => {
            const selected = option.id === householdId
            return (
              <Pressable
                key={option.id ?? "personal"}
                role="radio"
                aria-checked={selected}
                onPress={() => choose(option.id)}
                className={cn(
                  "min-h-14 flex-row items-center gap-3 rounded-md border px-4 py-2 active:bg-accent",
                  selected ? "border-primary bg-primary/10" : "border-border"
                )}
              >
                <Icon
                  as={option.icon}
                  size={20}
                  className="text-muted-foreground"
                />
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-base text-foreground">
                    {option.name}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {option.detail}
                  </Text>
                </View>
                {selected && (
                  <Icon as={Check} size={20} className="text-primary" />
                )}
              </Pressable>
            )
          })}
        </View>
      </Sheet>
    </>
  )
}
