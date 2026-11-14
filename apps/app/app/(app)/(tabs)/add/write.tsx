import { router } from "expo-router"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { manualSource } from "@workspace/schemas"

import { RecipeForm, useRecipeForm } from "@/components/recipe-form"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { useCreateRecipe } from "@/lib/recipes"

/** An empty recipe form. No AI is involved and there is no progress screen. */
export default function WriteRecipe() {
  const { t } = useTranslation()
  const form = useRecipeForm()
  const create = useCreateRecipe()

  function save() {
    form.submit((content) =>
      create.mutate(
        { ...content, source: manualSource },
        {
          onSuccess: (recipe) => {
            router.dismissAll()
            router.navigate(`/recipe/${recipe.id}`)
          },
        }
      )
    )
  }

  const problem =
    Object.keys(form.errors).length > 0
      ? t("add:fieldsNeedFix")
      : create.error?.message

  return (
    <Screen
      title={t("add:write.title")}
      subtitle={t("add:write.subtitle")}
      back="/add"
      narrow
      footer={
        <View className="gap-3">
          {problem && (
            <Text role="alert" className="text-sm text-destructive">
              {problem}
            </Text>
          )}
          <Button
            label={create.isPending ? t("add:saving") : t("add:saveRecipe")}
            disabled={create.isPending}
            onPress={save}
          />
        </View>
      }
    >
      <RecipeForm form={form} />
    </Screen>
  )
}
