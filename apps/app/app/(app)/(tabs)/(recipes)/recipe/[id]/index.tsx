import { router, useLocalSearchParams } from "expo-router"
import {
  ChefHat,
  Clock,
  Download,
  FileCode,
  FileJson,
  FileText,
  Pencil,
  SearchX,
  ShoppingCart,
} from "lucide-react-native"
import { useState } from "react"
import { Text, View } from "react-native"

import { toJson, toMarkdown, toSchemaOrg } from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { RecipeCover, sourceIcons, sourceName } from "@/components/recipe-card"
import {
  hasNutrition,
  IngredientList,
  NutritionEstimate,
  ServingsScaler,
  StepList,
} from "@/components/recipe-parts"
import { Screen } from "@/components/screen"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { formatMinutes } from "@/lib/format"
import { useIsWide } from "@/lib/layout"
import { ApiError } from "@/lib/api/client"
import { useRecipe, type Recipe } from "@/lib/recipes"
import { canShare, copyText, shareText } from "@/lib/share"
import {
  useListKind,
  useShoppingActions,
  useShoppingState,
} from "@/lib/shopping"
import { useHousehold } from "@/lib/households"

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useRecipe(id)

  if (query.isPending) {
    return (
      <Screen title="Recipe" back="/">
        <LoadingState label="Loading recipe" rows={2} />
      </Screen>
    )
  }

  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <Screen title={missing ? "Recipe not found" : "Recipe"} back="/">
        {missing ? (
          <EmptyState
            icon={SearchX}
            title="This recipe does not exist"
            message="It may have been deleted, or it is not shared with you."
            action="Back to recipes"
            onAction={() => router.replace("/")}
          />
        ) : (
          <ErrorState
            title="Could not load this recipe"
            message="Check your connection and try again."
            onRetry={() => void query.refetch()}
          />
        )}
      </Screen>
    )
  }

  return <RecipeView key={query.data.id} recipe={query.data} />
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const wide = useIsWide()
  const { units } = useAppState()
  const [servings, setServings] = useState(recipe.servings)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [added, setAdded] = useState<{ id: string; name: string } | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const { lists } = useShoppingState()
  const { addRecipe } = useShoppingActions()
  const { household } = useHousehold()
  const kindOf = useListKind()

  /** Puts the ingredients on a list, for the servings chosen above. */
  async function addToList(listId: string, name: string) {
    setAdding(listId)
    setListError(null)
    try {
      await addRecipe(listId, recipe.id, servings)
      setAdded({ id: listId, name })
    } catch (error) {
      setListError(
        error instanceof Error ? error.message : "Could not add the recipe."
      )
    } finally {
      setAdding(null)
    }
  }

  function closeListSheet() {
    setListOpen(false)
    setAdded(null)
    setListError(null)
  }

  const factor = servings / recipe.servings

  async function exportAs(name: string, text: string) {
    if (canShare) {
      setExportOpen(false)
      await shareText(text, recipe.title)
    } else {
      await copyText(text)
      setExportNote(`Copied ${name} to the clipboard.`)
    }
  }

  const ingredients = (
    <Card className="gap-4 p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <SectionTitle>Ingredients</SectionTitle>
        <ServingsScaler servings={servings} onChange={setServings} />
      </View>
      {recipe.ingredients.length > 0 ? (
        <IngredientList
          ingredients={recipe.ingredients}
          factor={factor}
          units={units}
        />
      ) : (
        <Text className="text-muted-foreground">No ingredients yet.</Text>
      )}
      {recipe.ingredients.length > 0 && (
        <Button
          variant="outline"
          icon={ShoppingCart}
          label="Add to shopping list"
          onPress={() => setListOpen(true)}
        />
      )}
    </Card>
  )

  const steps = (
    <Card className="gap-4 p-4">
      <SectionTitle>Steps</SectionTitle>
      {recipe.steps.length > 0 ? (
        <StepList recipeId={recipe.id} steps={recipe.steps} />
      ) : (
        <Text className="text-muted-foreground">No steps yet.</Text>
      )}
    </Card>
  )

  const nutrition = hasNutrition(recipe.nutrition) && (
    <Card className="gap-4 p-4">
      <SectionTitle>Nutrition</SectionTitle>
      <NutritionEstimate nutrition={recipe.nutrition} />
    </Card>
  )

  return (
    <Screen
      title={recipe.title}
      back="/"
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            icon={Pencil}
            label="Edit recipe"
            onPress={() => router.push(`/recipe/${recipe.id}/edit`)}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={Download}
            label="Export recipe"
            onPress={() => {
              setExportNote(null)
              setExportOpen(true)
            }}
          />
        </>
      }
    >
      <View className="gap-4 md:flex-row md:gap-6">
        <RecipeCover
          recipe={recipe}
          className="h-40 rounded-lg md:h-48 md:w-72"
        />
        <View className="flex-1 gap-3">
          {recipe.description !== "" && (
            <Text className="text-base text-muted-foreground">
              {recipe.description}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-x-5 gap-y-2">
            {recipe.prepMinutes !== null && (
              <Meta
                icon={Clock}
                text={`${formatMinutes(recipe.prepMinutes)} prep`}
              />
            )}
            {recipe.cookMinutes !== null && (
              <Meta
                icon={ChefHat}
                text={`${formatMinutes(recipe.cookMinutes)} cooking`}
              />
            )}
            <Meta
              icon={sourceIcons[recipe.source.kind] ?? FileText}
              text={sourceName(recipe)}
            />
          </View>
          {recipe.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <Badge key={tag} label={tag} />
              ))}
            </View>
          )}
          {recipe.steps.length > 0 && (
            <Button
              size="lg"
              icon={ChefHat}
              label="Start cooking"
              className="mt-1 md:self-start"
              onPress={() => router.push(`/cook/${recipe.id}`)}
            />
          )}
        </View>
      </View>

      {wide ? (
        <View className="flex-row items-start gap-6">
          <View className="flex-[2] gap-6">
            {ingredients}
            {nutrition}
          </View>
          <View className="flex-[3]">{steps}</View>
        </View>
      ) : (
        <>
          {ingredients}
          {steps}
          {nutrition}
        </>
      )}

      <Sheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export recipe"
      >
        <ListGroup>
          <ListRow
            icon={FileJson}
            title="JSON"
            detail="For backups and other apps"
            onPress={() => void exportAs("JSON", toJson(recipe))}
          />
          <ListRow
            icon={FileText}
            title="Markdown"
            detail="Plain text to read or print"
            onPress={() => void exportAs("Markdown", toMarkdown(recipe))}
          />
          <ListRow
            icon={FileCode}
            title="schema.org Recipe"
            detail="Standard recipe format for the web"
            onPress={() =>
              void exportAs(
                "schema.org Recipe",
                JSON.stringify(toSchemaOrg(recipe), null, 2)
              )
            }
          />
        </ListGroup>
        {exportNote && (
          <Text role="status" className="text-sm text-muted-foreground">
            {exportNote}
          </Text>
        )}
        <Button
          variant="outline"
          label={exportNote ? "Done" : "Cancel"}
          onPress={() => setExportOpen(false)}
        />
      </Sheet>

      <Sheet
        open={listOpen}
        onClose={closeListSheet}
        title={added ? "Added to your list" : "Add to which list?"}
      >
        {added ? (
          <>
            <Text role="status" className="text-foreground">
              The ingredients for {servings} servings of {recipe.title} are on{" "}
              {added.name}. Same ingredients were merged.
            </Text>
            <Button
              label="Open the list"
              onPress={() => {
                closeListSheet()
                router.push(`/shopping/${added.id}`)
              }}
            />
            <Button variant="outline" label="Done" onPress={closeListSheet} />
          </>
        ) : (
          <>
            {lists.length === 0 ? (
              <Text className="text-muted-foreground">
                You have no shopping lists yet. Make one first.
              </Text>
            ) : (
              <ListGroup>
                {lists.map((list) => (
                  <ListRow
                    key={list.id}
                    icon={ShoppingCart}
                    title={list.name}
                    detail={`${kindOf(list, household?.name)} · ${list.items.length} items`}
                    right={
                      adding === list.id ? (
                        <Text className="text-sm text-muted-foreground">
                          Adding…
                        </Text>
                      ) : undefined
                    }
                    onPress={
                      adding ? undefined : () => void addToList(list.id, list.name)
                    }
                  />
                ))}
              </ListGroup>
            )}
            {listError && (
              <Text role="alert" className="text-sm text-destructive">
                {listError}
              </Text>
            )}
            <Button
              variant="outline"
              label="New list"
              onPress={() => {
                closeListSheet()
                router.push("/shopping")
              }}
            />
            <Button variant="outline" label="Cancel" onPress={closeListSheet} />
          </>
        )}
      </Sheet>
    </Screen>
  )
}

function Meta({ icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon as={icon} size={16} className="text-muted-foreground" />
      <Text className="text-sm text-muted-foreground">{text}</Text>
    </View>
  )
}
