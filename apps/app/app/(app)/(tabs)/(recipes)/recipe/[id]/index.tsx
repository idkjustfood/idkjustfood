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
import { useTranslation } from "react-i18next"
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
import { TagBadge } from "@/components/tag-badge"
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

export default function RecipeDetail() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useRecipe(id)

  if (query.isPending) {
    return (
      <Screen title={t("recipes:detail.title")} back="/">
        <LoadingState label={t("recipes:detail.loading")} rows={2} />
      </Screen>
    )
  }

  if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404
    return (
      <Screen title={
          missing ? t("recipes:errors.notFound") : t("recipes:detail.title")
        } back="/">
        {missing ? (
          <EmptyState
            icon={SearchX}
            title={t("recipes:missing.title")}
            message={t("recipes:missing.message")}
            action={t("recipes:missing.action")}
            onAction={() => router.replace("/")}
          />
        ) : (
          <ErrorState
            title={t("recipes:errors.loadRecipe")}
            message={t("recipes:errors.checkConnection")}
            onRetry={() => void query.refetch()}
          />
        )}
      </Screen>
    )
  }

  return <RecipeView key={query.data.id} recipe={query.data} />
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation()
  const wide = useIsWide()
  const { units } = useAppState()
  const [servings, setServings] = useState(recipe.servings)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [added, setAdded] = useState<{
    id: string
    name: string
    skipped: string[]
  } | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const { lists } = useShoppingState()
  const { addRecipe } = useShoppingActions()
  const kindOf = useListKind()

  /** Puts the ingredients on a list, for the servings chosen above. */
  async function addToList(listId: string, name: string) {
    setAdding(listId)
    setListError(null)
    try {
      const { skipped } = await addRecipe(listId, recipe.id, servings)
      setAdded({ id: listId, name, skipped })
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : t("recipes:errors.addToList")
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
      setExportNote(t("recipes:export.copied", { name }))
    }
  }

  const ingredients = (
    <Card className="gap-4 p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <SectionTitle>{t("recipes:detail.ingredients")}</SectionTitle>
        <ServingsScaler servings={servings} onChange={setServings} />
      </View>
      {recipe.ingredients.length > 0 ? (
        <IngredientList
          ingredients={recipe.ingredients}
          factor={factor}
          units={units}
        />
      ) : (
        <Text className="text-muted-foreground">{t("recipes:detail.noIngredients")}</Text>
      )}
      {recipe.ingredients.length > 0 && (
        <Button
          variant="outline"
          icon={ShoppingCart}
          label={t("recipes:detail.addToList")}
          onPress={() => setListOpen(true)}
        />
      )}
    </Card>
  )

  const steps = (
    <Card className="gap-4 p-4">
      <SectionTitle>{t("recipes:detail.steps")}</SectionTitle>
      {recipe.steps.length > 0 ? (
        <StepList
          recipeId={recipe.id}
          steps={recipe.steps}
          ingredients={recipe.ingredients}
        />
      ) : (
        <Text className="text-muted-foreground">{t("recipes:detail.noSteps")}</Text>
      )}
    </Card>
  )

  const nutrition = hasNutrition(recipe.nutrition) && (
    <Card className="gap-4 p-4">
      <SectionTitle>{t("recipes:detail.nutrition")}</SectionTitle>
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
            label={t("recipes:detail.edit")}
            onPress={() => router.push(`/recipe/${recipe.id}/edit`)}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={Download}
            label={t("recipes:detail.export")}
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
                text={t("recipes:detail.prep", {
                  time: formatMinutes(recipe.prepMinutes),
                })}
              />
            )}
            {recipe.cookMinutes !== null && (
              <Meta
                icon={ChefHat}
                text={t("recipes:detail.cooking", {
                  time: formatMinutes(recipe.cookMinutes),
                })}
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
                <TagBadge key={tag} tag={tag} />
              ))}
            </View>
          )}
          {recipe.steps.length > 0 && (
            <Button
              size="lg"
              icon={ChefHat}
              label={t("recipes:detail.startCooking")}
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
        title={t("recipes:export.title")}
      >
        <ListGroup>
          <ListRow
            icon={FileJson}
            title={t("recipes:export.json")}
            detail={t("recipes:export.jsonDetail")}
            onPress={() => void exportAs("JSON", toJson(recipe))}
          />
          <ListRow
            icon={FileText}
            title={t("recipes:export.markdown")}
            detail={t("recipes:export.markdownDetail")}
            onPress={() => void exportAs("Markdown", toMarkdown(recipe))}
          />
          <ListRow
            icon={FileCode}
            title={t("recipes:export.schemaOrg")}
            detail={t("recipes:export.schemaOrgDetail")}
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
          label={
            exportNote ? t("recipes:export.done") : t("recipes:export.cancel")
          }
          onPress={() => setExportOpen(false)}
        />
      </Sheet>

      <Sheet
        open={listOpen}
        onClose={closeListSheet}
        title={
          added
            ? t("recipes:addToList.titleAdded")
            : t("recipes:addToList.titleChoose")
        }
      >
        {added ? (
          <>
            <Text role="status" className="text-foreground">
              {t("recipes:addToList.added", {
                count: servings,
                title: recipe.title,
                list: added.name,
              })}
            </Text>
            {added.skipped.length > 0 && (
              <Text role="status" className="text-muted-foreground">
                {t("recipes:addToList.skipped", {
                  items: added.skipped.join(", "),
                })}
              </Text>
            )}
            <Button
              label={t("recipes:addToList.open")}
              onPress={() => {
                closeListSheet()
                router.push(`/shopping/${added.id}`)
              }}
            />
            <Button
              variant="outline"
              label={t("recipes:addToList.done")}
              onPress={closeListSheet}
            />
          </>
        ) : (
          <>
            {lists.length === 0 ? (
              <Text className="text-muted-foreground">
                {t("recipes:addToList.noLists")}
              </Text>
            ) : (
              <ListGroup>
                {lists.map((list) => (
                  <ListRow
                    key={list.id}
                    icon={ShoppingCart}
                    title={list.name}
                    detail={t("recipes:addToList.listDetail", {
                      kind: kindOf(list),
                      count: list.items.length,
                    })}
                    right={
                      adding === list.id ? (
                        <Text className="text-sm text-muted-foreground">
                          {t("recipes:addToList.adding")}
                        </Text>
                      ) : undefined
                    }
                    onPress={
                      adding
                        ? undefined
                        : () => void addToList(list.id, list.name)
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
              label={t("recipes:addToList.newList")}
              onPress={() => {
                closeListSheet()
                router.push("/shopping")
              }}
            />
            <Button
              variant="outline"
              label={t("recipes:addToList.cancel")}
              onPress={closeListSheet}
            />
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
