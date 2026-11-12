import { Redirect, router, useLocalSearchParams } from "expo-router"
import { View } from "react-native"

import { RecipeForm } from "@/components/recipe-form"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { findRecipe } from "@/lib/mock-data"

export default function EditRecipe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const recipe = findRecipe(id)
  if (!recipe) return <Redirect href="/" />

  const done = () =>
    router.canGoBack() ? router.back() : router.replace(`/recipe/${recipe.id}`)

  return (
    <Screen
      title="Edit recipe"
      back={`/recipe/${recipe.id}`}
      narrow
      footer={
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            label="Cancel"
            className="flex-1"
            onPress={done}
          />
          <Button label="Save" className="flex-1" onPress={done} />
        </View>
      }
    >
      <RecipeForm recipe={recipe} />
    </Screen>
  )
}
