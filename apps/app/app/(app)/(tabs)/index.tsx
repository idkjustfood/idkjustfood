import { router, type Href } from "expo-router"
import { ChefHat, Repeat, ShoppingCart, Sun } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { dayLabel } from "@/lib/planner-format"
import { todayString } from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { SearchButton } from "@/components/search-button"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { CheckboxBox } from "@/components/ui/checkbox"
import { useChoreActions, useToday } from "@/lib/chores"
import { useIsWide } from "@/lib/layout"
import { todaySections, type TodayItem } from "@/lib/today"
import { useTodayItems } from "@/lib/use-today"

/** Today: a timeline that collects what is on from the modules that provide items. */
export default function Today() {
  const { t } = useTranslation(["modules", "chores"])
  const wide = useIsWide()
  const { items, loading, error, retry } = useTodayItems()
  const sections = todaySections(items)

  return (
    <Screen
      title={t("areas.today")}
      subtitle={dayLabel(todayString())}
      actions={<SearchButton />}
      toolbar={!wide ? <SpaceSwitcher /> : undefined}
      narrow
    >
      {loading && <LoadingState label={t("today.loading")} rows={2} />}
      {!loading && error && (
        <ErrorState
          title={t("today.error")}
          message={t("today.errorMessage")}
          onRetry={retry}
        />
      )}
      {!loading && items.length === 0 && (
        <EmptyState
          icon={Sun}
          title={t("today.emptyTitle")}
          message={t("today.emptyMessage")}
        />
      )}
      {sections.map((section) => (
        <ListGroup key={section.id} title={t(`today.sections.${section.id}`)}>
          {section.items.map((item) => (
            <TimelineRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ListGroup>
      ))}
      {items.length > 0 && (
        <View className="px-1">
          <Text className="text-sm text-muted-foreground">
            {t("today.more")}
          </Text>
        </View>
      )}
    </Screen>
  )
}

function TimelineRow({ item }: { item: TodayItem }) {
  const { t } = useTranslation("modules")
  const actions = useChoreActions()
  const today = useToday()
  if (item.kind === "meal")
    return (
      <ListRow
        icon={ChefHat}
        title={item.title}
        detail={`${t(`today.slots.${item.slot}`)} · ${t("today.servings", { count: item.servings })}`}
        onPress={() => router.push(`/recipe/${item.recipeId}` as Href)}
      />
    )
  if (item.kind === "chore")
    return (
      <ListRow
        icon={Repeat}
        title={item.name}
        detail={
          item.overdueDays > 0
            ? t("today.overdue", { count: item.overdueDays })
            : t("chores:every", { count: item.intervalDays })
        }
        onPress={() => router.push("/chores" as Href)}
        right={
          <Pressable
            role="checkbox"
            aria-checked={false}
            accessibilityLabel={t("chores:markDone", { name: item.name })}
            onPress={() => actions.check(item.id, today)}
            hitSlop={8}
            className="-my-3 -mr-4 min-h-14 min-w-14 items-center justify-center"
          >
            <CheckboxBox checked={false} />
          </Pressable>
        }
      />
    )
  return (
    <ListRow
      icon={ShoppingCart}
      title={item.listName}
      detail={t("today.toBuy", { count: item.open })}
      onPress={() => router.push(`/shopping/${item.listId}` as Href)}
    />
  )
}
