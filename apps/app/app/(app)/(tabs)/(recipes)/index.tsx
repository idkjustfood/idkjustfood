import { router } from "expo-router"
import { BookOpen, SearchX } from "lucide-react-native"
import { useState } from "react"
import { ScrollView, View } from "react-native"

import { Grid } from "@/components/grid"
import { RecipeCard } from "@/components/recipe-card"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Chip } from "@/components/ui/chip"
import { SearchField } from "@/components/ui/search-field"
import { useAppState } from "@/lib/app-state"
import { useIsWide } from "@/lib/layout"
import { useHousehold } from "@/lib/households"
import { recipes, recipeTags } from "@/lib/mock-data"

export default function RecipeList() {
  const wide = useIsWide()
  const { space, listState, setListState } = useAppState()
  const { household } = useHousehold()
  const [query, setQuery] = useState("")
  const [tags, setTags] = useState<string[]>([])

  const inSpace =
    listState === "empty" ? [] : recipes.filter((r) => r.space === space)
  const q = query.trim().toLowerCase()
  const shown = inSpace.filter(
    (r) =>
      (!q ||
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))) &&
      tags.every((t) => r.tags.includes(t))
  )

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag]
    )
  }

  const hasRecipes = listState === "ready" && inSpace.length > 0

  const tagChips = recipeTags.map((tag) => (
    <Chip
      key={tag}
      label={tag}
      selected={tags.includes(tag)}
      onPress={() => toggleTag(tag)}
    />
  ))

  return (
    <Screen
      title="Recipes"
      subtitle={
        space === "household"
          ? `Shared with ${household?.name ?? "your household"}`
          : "Your own recipes"
      }
      toolbar={
        <View className="gap-3">
          {!wide && <SpaceSwitcher />}
          {hasRecipes && (
            <>
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search recipes or ingredients"
              />
              {wide ? (
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
              )}
            </>
          )}
        </View>
      }
    >
      {listState === "loading" && <LoadingState label="Loading recipes" />}
      {listState === "error" && (
        <ErrorState
          title="Could not load your recipes"
          message="Check your connection and try again."
          onRetry={() => setListState("ready")}
        />
      )}
      {listState !== "loading" &&
        listState !== "error" &&
        inSpace.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="No recipes yet"
            message="Share a reel from Instagram or paste a link, and the recipe shows up here."
            action="Add your first recipe"
            onAction={() => router.push("/add")}
          />
        )}
      {hasRecipes && shown.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="Nothing found"
          message="No recipe matches your search and filters."
          action="Clear filters"
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
