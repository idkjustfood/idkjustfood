import { router, useLocalSearchParams } from "expo-router"
import { SearchX } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { RecipeForm, useRecipeForm } from "@/components/recipe-form"
import { Screen } from "@/components/screen"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import {
  useDeleteRecipe,
  useRecipe,
  useUpdateRecipe,
  type Recipe,
} from "@/lib/recipes"

/**
 * Check a recipe that was read from a link, photo or text. The server has already saved
 * it, so "Save" keeps your changes and "Discard" deletes it. Missing amounts stay empty,
 * never guessed, and are highlighted.
 */
export default function Review() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useRecipe(id)

  if (query.isPending) {
    return (
      <Screen title={t("add:review.title")} back="/add" narrow>
        <LoadingState label={t("add:review.loading")} rows={2} />
      </Screen>
    )
  }
  if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404
    return (
      <Screen title={t("add:review.title")} back="/add" narrow>
        {missing ? (
          <EmptyState
            icon={SearchX}
            title={t("add:review.missingTitle")}
            message={t("add:review.missingMessage")}
            action={t("add:review.backToOptions")}
            onAction={() => router.replace("/add")}
          />
        ) : (
          <ErrorState
            title={t("add:review.loadErrorTitle")}
            message={t("add:review.loadErrorMessage")}
            onRetry={() => void query.refetch()}
          />
        )}
      </Screen>
    )
  }
  return <ReviewForm key={query.data.id} recipe={query.data} />
}

function ReviewForm({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation()
  const form = useRecipeForm(recipe)
  const update = useUpdateRecipe(recipe.id)
  const remove = useDeleteRecipe(recipe.id)
  const { demo } = useAppState()

  const open = () => {
    router.dismissAll()
    router.navigate(`/recipe/${recipe.id}`)
  }

  function save() {
    // Sample data cannot be saved: just show it.
    if (demo) return open()
    form.submit((content) =>
      update.mutate({ ...content, source: recipe.source }, { onSuccess: open })
    )
  }

  function discard() {
    if (demo) return router.replace("/add")
    remove.mutate(undefined, { onSuccess: () => router.replace("/add") })
  }

  const busy = update.isPending || remove.isPending
  const problem =
    Object.keys(form.errors).length > 0
      ? t("add:fieldsNeedFix")
      : (update.error ?? remove.error)?.message

  return (
    <Screen
      title={t("add:review.title")}
      subtitle={
        recipe.source.label
          ? t("add:review.from", { source: recipe.source.label })
          : undefined
      }
      back="/add"
      narrow
      footer={
        <View className="gap-3">
          {problem && (
            <Text role="alert" className="text-sm text-destructive">
              {problem}
            </Text>
          )}
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label={remove.isPending ? t("add:review.discarding") : t("add:review.discard")}
              className="flex-1"
              disabled={busy}
              onPress={discard}
            />
            <Button
              label={update.isPending ? t("add:saving") : t("add:saveRecipe")}
              className="flex-1"
              disabled={busy}
              onPress={save}
            />
          </View>
        </View>
      }
    >
      <RecipeForm form={form} highlightMissing />
    </Screen>
  )
}
