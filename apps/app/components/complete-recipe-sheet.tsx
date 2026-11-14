import { Sparkles } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Text, TextInput, View } from "react-native"

import { maxCompletionMessage } from "@workspace/schemas"

import { SectionHeading } from "@/components/recipe-parts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import {
  addedItems,
  completeErrorMessage,
  useCompleteRecipe,
  type CompletedRecipe,
} from "@/lib/complete-recipe"
import { formatAmount, type Units } from "@/lib/format"
import { useUpdateRecipe, type Recipe } from "@/lib/recipes"

/**
 * "Complete with AI": the person says what is missing, the AI writes it, and the new
 * ingredients and steps are shown as a preview. Nothing is saved before "Save".
 */
export function CompleteRecipeSheet({
  recipe,
  open,
  onClose,
}: {
  recipe: Recipe
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { units } = useAppState()
  const complete = useCompleteRecipe(recipe.id)
  const update = useUpdateRecipe(recipe.id)
  const [message, setMessage] = useState("")
  const [result, setResult] = useState<CompletedRecipe | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSend = message.trim().length > 0 && !complete.isPending

  function close() {
    onClose()
    // Keep the typed message only while the sheet is open; a closed sheet starts fresh.
    setMessage("")
    setResult(null)
    setError(null)
  }

  async function send() {
    if (!canSend) return
    setError(null)
    try {
      setResult(await complete.mutateAsync(message))
    } catch (cause) {
      // The message stays in the box, so the person can try again.
      setError(completeErrorMessage(cause))
    }
  }

  async function save() {
    if (!result) return
    setError(null)
    try {
      await update.mutateAsync({
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        tags: recipe.tags,
        nutrition: recipe.nutrition,
        source: recipe.source,
        ingredients: result.ingredients,
        steps: result.steps,
      })
      close()
    } catch (cause) {
      setError(completeErrorMessage(cause))
    }
  }

  const added = result ? addedItems(result) : null

  return (
    <Sheet open={open} onClose={close} title={t("recipes:complete.title")}>
      {added ? (
        <>
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge variant="warning" label={t("recipes:complete.aiWritten")} />
            <Text className="flex-1 text-sm text-muted-foreground">
              {t("recipes:complete.unchanged")}
            </Text>
          </View>
          <View className="max-h-96 gap-3">
            <Preview added={added} units={units} />
          </View>
          {error && (
            <Text role="alert" className="text-sm text-destructive">
              {error}
            </Text>
          )}
          <View className="gap-2">
            <Button
              label={
                update.isPending
                  ? t("recipes:complete.saving")
                  : t("recipes:complete.save")
              }
              disabled={update.isPending}
              onPress={() => void save()}
            />
            <Button
              variant="outline"
              label={t("recipes:complete.discard")}
              disabled={update.isPending}
              onPress={close}
            />
          </View>
        </>
      ) : (
        <>
          <Text className="text-sm text-muted-foreground">
            {t("recipes:complete.intro")}
          </Text>
          <TextInput
            accessibilityLabel={t("recipes:complete.messageLabel")}
            placeholder={t("recipes:complete.placeholder")}
            placeholderTextColor="#737373"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={maxCompletionMessage}
            editable={!complete.isPending}
            textAlignVertical="top"
            className="min-h-28 rounded-md border border-input bg-background p-3 text-base text-foreground"
          />
          {error && (
            <Text role="alert" className="text-sm text-destructive">
              {error}
            </Text>
          )}
          <View className="gap-2">
            <Button
              icon={complete.isPending ? undefined : Sparkles}
              label={
                complete.isPending
                  ? t("recipes:complete.sending")
                  : error
                    ? t("recipes:complete.retry")
                    : t("recipes:complete.send")
              }
              disabled={!canSend}
              onPress={() => void send()}
            />
            {complete.isPending && (
              <View
                role="status"
                className="flex-row items-center justify-center gap-2"
              >
                <ActivityIndicator />
                <Text className="text-sm text-muted-foreground">
                  {t("recipes:complete.loading")}
                </Text>
              </View>
            )}
            <Button
              variant="outline"
              label={t("recipes:complete.cancel")}
              onPress={close}
            />
          </View>
        </>
      )}
    </Sheet>
  )
}

type AddedItems = ReturnType<typeof addedItems>

function Preview({
  added,
  units,
}: {
  added: AddedItems
  units: Units
}) {
  const { t } = useTranslation()
  const sections = [
    ...new Set(
      [...added.ingredients, ...added.steps]
        .map((item) => item.section?.trim())
        .filter((name): name is string => !!name)
    ),
  ]
  return (
    <View className="gap-3">
      {sections.length > 0 && <SectionHeading name={sections.join(", ")} />}
      {added.ingredients.length > 0 && (
        <View className="gap-1">
          <Text className="text-sm font-medium text-muted-foreground">
            {t("recipes:detail.ingredients")}
          </Text>
          {added.ingredients.map((ingredient, i) => (
            <View
              key={i}
              className="flex-row items-start gap-2 rounded-md bg-amber-100 p-2 dark:bg-amber-950"
            >
              <Badge variant="warning" label={t("recipes:complete.new")} />
              <Text className="flex-1 text-base text-foreground">
                {formatAmount(ingredient, 1, units) ??
                  t("recipes:parts.noAmount")}{" "}
                {ingredient.name}
                {ingredient.note ? ` (${ingredient.note})` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
      {added.steps.length > 0 && (
        <View className="gap-1">
          <Text className="text-sm font-medium text-muted-foreground">
            {t("recipes:detail.steps")}
          </Text>
          {added.steps.map((step, i) => (
            <View
              key={i}
              className="flex-row items-start gap-2 rounded-md bg-amber-100 p-2 dark:bg-amber-950"
            >
              <Badge variant="warning" label={t("recipes:complete.new")} />
              <Text className="flex-1 text-base text-foreground">
                {step.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
