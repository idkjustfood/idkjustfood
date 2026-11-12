import { router } from "expo-router"
import { View } from "react-native"

import { RecipeForm, useRecipeForm } from "@/components/recipe-form"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { importedRecipe } from "@/lib/mock-data"
import { fromSample } from "@/lib/recipes"

/**
 * Check an imported recipe before saving. Missing amounts stay empty, never guessed.
 * Still a prototype: the recipe is sample data until the AI pipeline is connected.
 */
export default function Review() {
  const form = useRecipeForm(fromSample(importedRecipe))
  return (
    <Screen
      title="Review recipe"
      subtitle={`From ${importedRecipe.source.label}`}
      back="/add"
      narrow
      footer={
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            label="Discard"
            className="flex-1"
            onPress={() => router.replace("/add")}
          />
          <Button
            label="Save recipe"
            className="flex-1"
            onPress={() => {
              // Nothing is saved yet: this only opens the sample result.
              router.dismissAll()
              router.navigate(`/recipe/${importedRecipe.id}`)
            }}
          />
        </View>
      }
    >
      <RecipeForm form={form} highlightMissing />
    </Screen>
  )
}
