import { router, useLocalSearchParams } from "expo-router"
import { SearchX, Trash2 } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { RecipeForm, useRecipeForm } from "@/components/recipe-form"
import { Screen } from "@/components/screen"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { ApiError } from "@/lib/api/client"
import {
  useDeleteRecipe,
  useRecipe,
  useUpdateRecipe,
  type Recipe,
} from "@/lib/recipes"

export default function EditRecipe() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useRecipe(id)

  if (query.isPending) {
    return (
      <Screen title={t("recipes:edit.title")} back="/" narrow>
        <LoadingState label={t("recipes:detail.loading")} rows={2} />
      </Screen>
    )
  }
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <Screen title={t("recipes:edit.title")} back="/" narrow>
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
  // The form starts from the loaded recipe, so it is only created once that has arrived.
  return <EditForm key={query.data.id} recipe={query.data} />
}

function EditForm({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation()
  const form = useRecipeForm(recipe)
  const update = useUpdateRecipe(recipe.id)
  const remove = useDeleteRecipe(recipe.id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const done = () =>
    router.canGoBack() ? router.back() : router.replace(`/recipe/${recipe.id}`)

  function save() {
    form.submit((content) =>
      update.mutate({ ...content, source: recipe.source }, { onSuccess: done })
    )
  }

  function deleteRecipe() {
    remove.mutate(undefined, {
      onSuccess: () => {
        setConfirmDelete(false)
        router.dismissAll()
        router.replace("/")
      },
    })
  }

  const problem =
    Object.keys(form.errors).length > 0
      ? t("recipes:edit.fixFields")
      : update.error?.message

  return (
    <Screen
      title={t("recipes:edit.title")}
      back={`/recipe/${recipe.id}`}
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
              label={t("recipes:edit.cancel")}
              className="flex-1"
              onPress={done}
            />
            <Button
              label={
                update.isPending ? t("recipes:edit.saving") : t("recipes:edit.save")
              }
              className="flex-1"
              disabled={update.isPending}
              onPress={save}
            />
          </View>
        </View>
      }
    >
      <RecipeForm form={form} />
      <Button
        variant="outline"
        icon={Trash2}
        label={t("recipes:edit.delete")}
        onPress={() => {
          remove.reset()
          setConfirmDelete(true)
        }}
      />

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("recipes:edit.deleteTitle")}
      >
        <Text className="text-base text-muted-foreground">
          {t(
            recipe.householdId
              ? "recipes:edit.deleteConfirmHousehold"
              : "recipes:edit.deleteConfirm",
            { title: recipe.title }
          )}
        </Text>
        {remove.error && (
          <Text role="alert" className="text-sm text-destructive">
            {remove.error.message}
          </Text>
        )}
        <Button
          variant="destructive"
          label={
            remove.isPending
              ? t("recipes:edit.deleting")
              : t("recipes:edit.delete")
          }
          disabled={remove.isPending}
          onPress={deleteRecipe}
        />
        <Button
          variant="outline"
          label={t("recipes:edit.keep")}
          onPress={() => setConfirmDelete(false)}
        />
      </Sheet>
    </Screen>
  )
}
