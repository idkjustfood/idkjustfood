import { router } from "expo-router"
import { BookOpen, ChevronDown, SearchX, SlidersHorizontal, X } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { isTagKey, sortTags, type TagKey } from "@workspace/schemas"

import { Grid } from "@/components/grid"
import { RecipeCard } from "@/components/recipe-card"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { MealTabs } from "@/components/meal-tabs"
import { RecipeFilterSheet } from "@/components/recipe-filter-sheet"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { SearchField } from "@/components/ui/search-field"
import { useAppState } from "@/lib/app-state"
import { useHousehold } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import {
  filterTags,
  isOtherTag,
  mealCounts,
  recipeSorts,
  sortRecipes,
  type MealTab,
  type RecipeSort,
} from "@/lib/recipe-filters"
import { useRecipes } from "@/lib/recipes"
import { tagName } from "@/lib/tags"

/** Waits a moment after typing before the search is sent. */
function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timeout)
  }, [value, ms])
  return debounced
}

export default function RecipeList() {
  const { t } = useTranslation()
  const wide = useIsWide()
  const { space } = useAppState()
  const { household } = useHousehold()
  const [query, setQuery] = useState("")
  const [meal, setMeal] = useState<MealTab>("all")
  const [others, setOthers] = useState<TagKey[]>([])
  const [sort, setSort] = useState<RecipeSort>("newest")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const search = useDebounced(query)

  // Everything in this space: gives the meal counts, the filter tags and tells empty from "nothing found".
  const all = useRecipes({ q: "", tags: [] })
  const found = useRecipes({ q: search, tags: filterTags(meal, others) })

  const counts = useMemo(() => mealCounts(all.data ?? []), [all.data])

  // The non-meal tags in use, in the fixed order of the list: grouped, same everywhere.
  const available = useMemo(() => {
    const names = new Set<TagKey>(others)
    for (const recipe of all.data ?? []) {
      for (const tag of recipe.tags) {
        if (isTagKey(tag) && isOtherTag(tag)) names.add(tag)
      }
    }
    return sortTags([...names])
  }, [all.data, others])

  const hasRecipes = (all.data?.length ?? 0) > 0
  const shown = useMemo(
    () => sortRecipes(found.data ?? [], sort),
    [found.data, sort]
  )

  return (
    <Screen
      title={t("recipes:list.title")}
      subtitle={
        space === "household"
          ? t("recipes:list.subtitleHousehold", {
              name: household?.name ?? t("recipes:list.householdFallback"),
            })
          : t("recipes:list.subtitlePersonal")
      }
      toolbar={
        <View className="gap-3">
          {!wide && <SpaceSwitcher />}
          {hasRecipes && (
            <>
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <SearchField
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("recipes:list.searchPlaceholder")}
                  />
                </View>
                <View>
                  <Button
                    variant="outline"
                    size="icon"
                    icon={SlidersHorizontal}
                    label={t("recipes:list.filters")}
                    onPress={() => setFiltersOpen(true)}
                  />
                  {others.length > 0 && (
                    <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
                      <Text className="text-xs font-medium text-primary-foreground">
                        {others.length}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <MealTabs value={meal} onChange={setMeal} counts={counts} />
              {others.length > 0 && (
                <View className="flex-row flex-wrap gap-2">
                  {others.map((tag) => (
                    <Pressable
                      key={tag}
                      role="button"
                      accessibilityLabel={t("recipes:list.removeFilter", {
                        name: tagName(tag),
                      })}
                      onPress={() =>
                        setOthers(others.filter((x) => x !== tag))
                      }
                      className="h-10 flex-row items-center gap-1 rounded-full bg-secondary pl-3 pr-2 active:opacity-80"
                    >
                      <Text className="text-sm font-medium text-secondary-foreground">
                        {tagName(tag)}
                      </Text>
                      <Icon as={X} size={16} className="text-muted-foreground" />
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                role="button"
                onPress={() => setSortOpen(true)}
                className="min-h-10 flex-row items-center gap-1 self-start active:opacity-80"
              >
                <Text className="text-sm text-muted-foreground">
                  {t("recipes:list.count", { count: shown.length })} ·{" "}
                  {t(`recipes:list.sort.${sort}`)}
                </Text>
                <Icon
                  as={ChevronDown}
                  size={16}
                  className="text-muted-foreground"
                />
              </Pressable>
            </>
          )}
        </View>
      }
    >
      {all.isPending && all.fetchStatus !== "idle" && (
        <LoadingState label={t("recipes:list.loading")} />
      )}
      {all.isError && (
        <ErrorState
          title={t("recipes:list.loadError")}
          message={t("recipes:errors.checkConnection")}
          onRetry={() => void all.refetch()}
        />
      )}
      {all.isSuccess && !hasRecipes && (
        <EmptyState
          icon={BookOpen}
          title={t("recipes:list.empty.title")}
          message={t("recipes:list.empty.message")}
          action={t("recipes:list.empty.action")}
          onAction={() => router.push("/add")}
        />
      )}
      {hasRecipes && found.isError && (
        <ErrorState
          title={t("recipes:list.searchError")}
          message={t("recipes:errors.checkConnection")}
          onRetry={() => void found.refetch()}
        />
      )}
      {hasRecipes && found.isSuccess && shown.length === 0 && (
        <EmptyState
          icon={SearchX}
          title={t("recipes:list.nothing.title")}
          message={t("recipes:list.nothing.message")}
          action={t("recipes:list.nothing.action")}
          onAction={() => {
            setQuery("")
            setMeal("all")
            setOthers([])
          }}
        />
      )}
      {hasRecipes && shown.length > 0 && (
        <Grid
          items={shown}
          keyOf={(r) => r.id}
          render={(r) => <RecipeCard recipe={r} />}
        />
      )}

      <RecipeFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        available={available}
        value={others}
        onChange={setOthers}
        resultCount={shown.length}
      />
      <Sheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title={t("recipes:list.sortTitle")}
      >
        <View className="flex-row flex-wrap gap-2">
          {recipeSorts.map((option) => (
            <Chip
              key={option}
              label={t(`recipes:list.sort.${option}`)}
              selected={sort === option}
              onPress={() => {
                setSort(option)
                setSortOpen(false)
              }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  )
}
