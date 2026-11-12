import { router, useLocalSearchParams } from "expo-router"
import { SearchX, Trash2 } from "lucide-react-native"
import { useState } from "react"
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
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useRecipe(id)

  if (query.isPending) {
    return (
      <Screen title="Edit recipe" back="/" narrow>
        <LoadingState label="Loading recipe" rows={2} />
      </Screen>
    )
  }
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <Screen title="Edit recipe" back="/" narrow>
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
  // The form starts from the loaded recipe, so it is only created once that has arrived.
  return <EditForm key={query.data.id} recipe={query.data} />
}

function EditForm({ recipe }: { recipe: Recipe }) {
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
      ? "Some fields need a fix. They are marked below."
      : update.error?.message

  return (
    <Screen
      title="Edit recipe"
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
              label="Cancel"
              className="flex-1"
              onPress={done}
            />
            <Button
              label={update.isPending ? "Saving…" : "Save"}
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
        label="Delete recipe"
        onPress={() => {
          remove.reset()
          setConfirmDelete(true)
        }}
      />

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this recipe?"
      >
        <Text className="text-base text-muted-foreground">
          “{recipe.title}” will be gone for good
          {recipe.householdId ? ", for everyone in your household" : ""}. This
          cannot be undone.
        </Text>
        {remove.error && (
          <Text role="alert" className="text-sm text-destructive">
            {remove.error.message}
          </Text>
        )}
        <Button
          variant="destructive"
          label={remove.isPending ? "Deleting…" : "Delete recipe"}
          disabled={remove.isPending}
          onPress={deleteRecipe}
        />
        <Button
          variant="outline"
          label="Keep it"
          onPress={() => setConfirmDelete(false)}
        />
      </Sheet>
    </Screen>
  )
}
