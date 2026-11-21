import { router, type Href } from "expo-router"
import { ChefHat, ShoppingCart, Sun } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { dayLabel } from "@/lib/planner-format"
import { todayString } from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { SearchButton } from "@/components/search-button"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { useIsWide } from "@/lib/layout"
import type { TodayItem } from "@/lib/today"
import { useTodayItems } from "@/lib/use-today"

/** Today: a timeline that collects what is on from the modules that provide items. */
export default function Today() {
  const { t } = useTranslation("modules")
  const wide = useIsWide()
  const { items, loading, error, retry } = useTodayItems()

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
      {items.length > 0 && (
        <ListGroup>
          {items.map((item) => (
            <TimelineRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ListGroup>
      )}
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
  if (item.kind === "meal")
    return (
      <ListRow
        icon={ChefHat}
        title={item.title}
        detail={`${t(`today.slots.${item.slot}`)} · ${t("today.servings", { count: item.servings })}`}
        onPress={() => router.push(`/recipe/${item.recipeId}` as Href)}
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
