import { Check, ChevronDown, User, Users } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
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
export function SpaceSwitcher() {
  const { t } = useTranslation("common")
  const { householdId, setHouseholdId } = useAppState()
  const { households } = useHouseholds()
  // Also falls back to the personal space when the selected household is gone.
  const { household } = useHousehold()
  const [open, setOpen] = useState(false)

  if (households.length === 0) return null

  const current = household?.name ?? t("space.personal")
  const options = [
    { id: null, name: t("space.personal"), detail: t("space.onlyYou"), icon: User },
    ...households.map((h) => ({
      id: h.id,
      name: h.name,
      detail: t("space.shared"),
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
        accessibilityLabel={t("space.change", { name: current })}
        onPress={() => setOpen(true)}
        className={cn(
          "h-11 w-full flex-row items-center gap-2 self-stretch rounded-md border border-border bg-card px-3 active:bg-accent web:hover:bg-accent"
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

      <Sheet open={open} onClose={() => setOpen(false)} title={t("space.choose")}>
        <View role="radiogroup" aria-label={t("space.label")} className="gap-2">
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
