import { ChevronLeft, ChevronRight } from "lucide-react-native"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { addDays, addMonths, parseCents, type MoneyCategory } from "@workspace/schemas"

import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { longDayLabel, monthLabel } from "@/lib/calendar-format"
import { cn } from "@/lib/utils"

/** The name of a category: the one the person gave, or the built-in name in their language. */
export function categoryName(
  t: TFunction,
  category: Pick<MoneyCategory, "key" | "name"> | undefined | null
) {
  if (!category) return t("money:uncategorized")
  if (category.name) return category.name
  return category.key ? t(`money:categories.${category.key}`) : t("money:uncategorized")
}

const stepButton =
  "h-12 w-12 items-center justify-center rounded-md border border-border bg-card active:bg-accent"

/** Moves between months with two big buttons. */
export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string
  onChange: (month: string) => void
}) {
  const { t } = useTranslation("money")
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        role="button"
        accessibilityLabel={t("previousMonth")}
        onPress={() => onChange(addMonths(month, -1))}
        className={stepButton}
      >
        <Icon as={ChevronLeft} className="text-foreground" />
      </Pressable>
      <Text
        role="heading"
        aria-live="polite"
        className="flex-1 text-center text-lg font-semibold text-foreground"
      >
        {monthLabel(month)}
      </Text>
      <Pressable
        role="button"
        accessibilityLabel={t("nextMonth")}
        onPress={() => onChange(addMonths(month, 1))}
        className={stepButton}
      >
        <Icon as={ChevronRight} className="text-foreground" />
      </Pressable>
    </View>
  )
}

/** A day, moved one day at a time. */
export function DayField({
  label,
  date,
  onChange,
}: {
  label: string
  date: string
  onChange: (date: string) => void
}) {
  const { t } = useTranslation("money")
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          role="button"
          accessibilityLabel={t("dayBefore")}
          onPress={() => onChange(addDays(date, -1))}
          className={stepButton}
        >
          <Icon as={ChevronLeft} className="text-foreground" />
        </Pressable>
        <Text className="flex-1 text-center text-base text-foreground">
          {longDayLabel(date)}
        </Text>
        <Pressable
          role="button"
          accessibilityLabel={t("dayAfter")}
          onPress={() => onChange(addDays(date, 1))}
          className={stepButton}
        >
          <Icon as={ChevronRight} className="text-foreground" />
        </Pressable>
      </View>
    </View>
  )
}

/**
 * An amount the person types. It is read with `parseCents`, so "12,50" and "12.5" both work;
 * what cannot be read is said, never guessed. `value` is the text, `cents` what it means.
 */
export function AmountField({
  label,
  value,
  onChange,
  autoFocus,
  onSubmit,
}: {
  label: string
  value: string
  onChange: (text: string) => void
  autoFocus?: boolean
  onSubmit?: () => void
}) {
  const { t } = useTranslation("money")
  const invalid = value.trim() !== "" && parseCents(value) === null
  return (
    <View className="gap-1">
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="0.00"
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        aria-invalid={invalid}
        className={cn(invalid && "border-destructive")}
      />
      {invalid && (
        <Text role="alert" className="text-sm text-destructive">
          {t("amountInvalid")}
        </Text>
      )}
    </View>
  )
}

/** Picks a category, or none. */
export function CategoryField({
  categories,
  value,
  onChange,
  label,
}: {
  categories: Pick<MoneyCategory, "id" | "key" | "name">[]
  value: string | null
  onChange: (id: string | null) => void
  label?: string
}) {
  const { t } = useTranslation("money")
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">
        {label ?? t("category")}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={t("uncategorized")}
          selected={value === null}
          onPress={() => onChange(null)}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={categoryName(t, category)}
            selected={value === category.id}
            onPress={() => onChange(category.id)}
          />
        ))}
      </View>
    </View>
  )
}
