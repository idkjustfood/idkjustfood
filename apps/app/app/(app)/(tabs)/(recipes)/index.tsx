import { router } from "expo-router"
import { BookOpen, SearchX } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ScrollView, View } from "react-native"

import { Grid } from "@/components/grid"
import { RecipeCard } from "@/components/recipe-card"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Chip } from "@/components/ui/chip"
import { SearchField } from "@/components/ui/search-field"
import { useAppState } from "@/lib/app-state"
import { useHousehold } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { useRecipes } from "@/lib/recipes"

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
  const { t, i18n } = useTranslation()
  const wide = useIsWide()
  const { space } = useAppState()
  const { household } = useHousehold()
  const [query, setQuery] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const search = useDebounced(query)

  // Everything in this space: gives the tag chips and tells empty from "nothing found".
  const all = useRecipes({ q: "", tags: [] })
  const found = useRecipes({ q: search, tags })

  const allTags = useMemo(() => {
    const names = new Set<string>(tags)
    for (const recipe of all.data ?? []) {
      for (const tag of recipe.tags) names.add(tag)
    }
    return [...names].sort((a, b) => a.localeCompare(b, i18n.language))
  }, [all.data, tags, i18n.language])

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag]
    )
  }

  const hasRecipes = (all.data?.length ?? 0) > 0
  const shown = found.data ?? []

  const tagChips = allTags.map((tag) => (
    <Chip
      key={tag}
      label={tag}
      selected={tags.includes(tag)}
      onPress={() => toggleTag(tag)}
    />
  ))

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
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={t("recipes:list.searchPlaceholder")}
              />
              {allTags.length > 0 &&
                (wide ? (
                  <View className="flex-row flex-wrap gap-2">{tagChips}</View>
                ) : (
                  // One scrolling row on phones, so the list stays close to the top.
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2 px-4"
                    className="-mx-4"
                  >
                    {tagChips}
                  </ScrollView>
                ))}
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
            setTags([])
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
    </Screen>
  )
}
