import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { formatNumber } from "@/lib/format"
import { mealTabs, type MealTab } from "@/lib/recipe-filters"
import { cn } from "@/lib/utils"

/**
 * Fixed row of meal tabs (All, Breakfast, Midday, Afternoon, Snack) with the
 * number of recipes in each. Always visible, big touch targets for one hand.
 */
export function MealTabs({
  value,
  counts,
  onChange,
}: {
  value: MealTab
  counts: Record<MealTab, number>
  onChange: (meal: MealTab) => void
}) {
  const { t } = useTranslation()
  return (
    <View
      role="tablist"
      accessibilityLabel={t("recipes:list.mealsLabel")}
      className="flex-row rounded-md bg-muted p-1"
    >
      {mealTabs.map((meal) => {
        const selected = meal === value
        const name =
          meal === "all" ? t("recipes:list.mealAll") : t(`common:tags.${meal}`)
        return (
          <Pressable
            key={meal}
            role="tab"
            aria-selected={selected}
            accessibilityLabel={`${name}, ${t("recipes:list.count", { count: counts[meal] })}`}
            onPress={() => onChange(meal)}
            className={cn(
              "min-h-12 flex-1 items-center justify-center rounded-sm px-0.5 py-1",
              selected && "bg-background shadow-sm"
            )}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className={cn(
                "text-xs font-medium",
                selected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {name}
            </Text>
            <Text
              className={cn(
                "text-xs",
                selected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {formatNumber(counts[meal])}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
