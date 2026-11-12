import { router } from "expo-router"
import { useState } from "react"
import { Text, View } from "react-native"

import { parseImport, type RecipeContent } from "@workspace/schemas"

import { RecipeForm, useRecipeForm } from "@/components/recipe-form"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCreateRecipe } from "@/lib/recipes"

/** Paste JSON from idkjustfood or a schema.org Recipe, check it, then save it. */
export default function ImportRecipe() {
  const [text, setText] = useState("")
  const [recipe, setRecipe] = useState<RecipeContent | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  if (recipe) return <ReviewImport recipe={recipe} onBack={() => setRecipe(null)} />

  function read() {
    const result = parseImport(text)
    if (result.ok) {
      setProblem(null)
      setRecipe(result.recipe)
    } else {
      setProblem(result.error)
    }
  }

  return (
    <Screen
      title="Import a recipe"
      subtitle="Paste a recipe exported from idkjustfood (JSON), or a schema.org Recipe."
      back="/add"
      narrow
      footer={
        <Button
          label="Read recipe"
          disabled={text.trim() === ""}
          onPress={read}
        />
      }
    >
      <Input
        label="Recipe JSON"
        value={text}
        onChangeText={(value) => {
          setText(value)
          setProblem(null)
        }}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        textAlignVertical="top"
        className="h-64 py-3 font-mono text-sm"
        placeholder={'{ "title": "…", "ingredients": […] }'}
      />
      {problem && (
        <Text role="alert" className="text-sm text-destructive">
          {problem}
        </Text>
      )}
    </Screen>
  )
}

function ReviewImport({
  recipe,
  onBack,
}: {
  recipe: RecipeContent
  onBack: () => void
}) {
  const form = useRecipeForm(recipe)
  const create = useCreateRecipe()

  function save() {
    form.submit((content) =>
      create.mutate(
        { ...content, source: recipe.source },
        {
          onSuccess: (saved) => {
            router.dismissAll()
            router.navigate(`/recipe/${saved.id}`)
          },
        }
      )
    )
  }

  const problem =
    Object.keys(form.errors).length > 0
      ? "Some fields need a fix. They are marked below."
      : create.error?.message

  return (
    <Screen
      title="Review recipe"
      subtitle="Check it before you save it. Missing amounts stay empty."
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
              label="Back"
              className="flex-1"
              onPress={onBack}
            />
            <Button
              label={create.isPending ? "Saving…" : "Save recipe"}
              className="flex-1"
              disabled={create.isPending}
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
