import { CircleAlert, Plus, Trash2 } from "lucide-react-native"
import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, TextInput, View } from "react-native"

import {
  draftFromRecipe,
  emptyDraft,
  readDraft,
  type DraftContent,
  type RecipeDraft,
} from "@workspace/schemas"

import type { TFunction } from "i18next"

import { Button } from "@/components/ui/button"
import { Card, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * The state of a recipe form. Screens create it, show `RecipeForm` with it and
 * call `submit` from their save button: it saves when the form is valid and
 * otherwise shows what to fix.
 */
export function useRecipeForm(initial?: DraftContent) {
  const counter = useRef(0)
  const newKey = useCallback(() => `row-${++counter.current}`, [])
  const [draft, setDraft] = useState<RecipeDraft>(() =>
    initial ? draftFromRecipe(initial, newKey) : emptyDraft(newKey)
  )
  const [showErrors, setShowErrors] = useState(false)
  const result = useMemo(() => readDraft(draft), [draft])

  return {
    draft,
    setDraft,
    newKey,
    errors: showErrors && !result.ok ? result.errors : {},
    /** Runs `save` with the recipe when the form is valid. */
    submit(save: (content: DraftContent) => void) {
      if (result.ok) save(result.content)
      else setShowErrors(true)
    },
  }
}

export type RecipeFormState = ReturnType<typeof useRecipeForm>

/** A compact input without a visible label, for rows of fields. */
function Field({
  label,
  className,
  warn,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; warn?: boolean }) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor="#737373"
      className={cn(
        "h-12 min-w-0 rounded-md border bg-background px-3 text-base text-foreground",
        warn
          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
          : "border-input",
        className
      )}
      {...props}
    />
  )
}

/** The text for a problem the draft reports, found by the field it belongs to. */
function errorText(t: TFunction, field: string) {
  if (field === "title") return t("recipes:form.errors.title")
  if (field === "servings") return t("recipes:form.errors.servings")
  if (field === "prepMinutes" || field === "cookMinutes") {
    return t("recipes:form.errors.minutes")
  }
  if (field.endsWith(".quantity")) return t("recipes:form.errors.quantity")
  if (field.endsWith(".name")) return t("recipes:form.errors.ingredientName")
  return t("recipes:form.errors.number")
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <Text role="alert" className="text-sm text-destructive">
      {message}
    </Text>
  )
}

/**
 * The editable form for a recipe: used to write a new recipe, to edit a saved
 * one and to review an import. With `highlightMissing`, ingredients without an
 * amount are marked so the person can fill them in.
 */
export function RecipeForm({
  form,
  highlightMissing,
}: {
  form: RecipeFormState
  highlightMissing?: boolean
}) {
  const { t } = useTranslation()
  const { draft, setDraft, newKey } = form
  // The draft reports problems in English; show them in the current language.
  const errors: Record<string, string> = Object.fromEntries(
    Object.keys(form.errors).map((field) => [field, errorText(t, field)])
  )

  const set = (patch: Partial<RecipeDraft>) =>
    setDraft((d) => ({ ...d, ...patch }))

  function setIngredient(
    key: string,
    patch: Partial<RecipeDraft["ingredients"][number]>
  ) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((i) =>
        i.key === key ? { ...i, ...patch } : i
      ),
    }))
  }

  function setStep(key: string, text: string) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.key === key ? { ...s, text } : s)),
    }))
  }

  const missing = draft.ingredients.filter(
    (i) => i.name.trim() && !i.quantity.trim()
  ).length

  return (
    <View className="gap-6">
      <Card className="gap-4 p-4">
        <View className="gap-1.5">
          <Input
            label={t("recipes:form.title")}
            value={draft.title}
            onChangeText={(title) => set({ title })}
            autoFocus={!draft.title}
          />
          <FieldError message={errors.title} />
        </View>
        <Input
          label={t("recipes:form.description")}
          value={draft.description}
          multiline
          className="h-24 py-3"
          textAlignVertical="top"
          onChangeText={(description) => set({ description })}
        />
        <View className="flex-row gap-3">
          <View className="flex-1 gap-1.5">
            <Input
              label={t("recipes:form.servings")}
              value={draft.servings}
              keyboardType="number-pad"
              onChangeText={(servings) => set({ servings })}
            />
            <FieldError message={errors.servings} />
          </View>
          <View className="flex-1 gap-1.5">
            <Input
              label={t("recipes:form.prep")}
              value={draft.prepMinutes}
              keyboardType="number-pad"
              onChangeText={(prepMinutes) => set({ prepMinutes })}
            />
            <FieldError message={errors.prepMinutes} />
          </View>
          <View className="flex-1 gap-1.5">
            <Input
              label={t("recipes:form.cooking")}
              value={draft.cookMinutes}
              keyboardType="number-pad"
              onChangeText={(cookMinutes) => set({ cookMinutes })}
            />
            <FieldError message={errors.cookMinutes} />
          </View>
        </View>
        <Input
          label={t("recipes:form.tags")}
          value={draft.tags}
          placeholder={t("recipes:form.tagsPlaceholder")}
          autoCapitalize="sentences"
          onChangeText={(tags) => set({ tags })}
        />
      </Card>

      <Card className="gap-4 p-4">
        <SectionTitle>{t("recipes:form.ingredients")}</SectionTitle>
        <Text className="text-sm text-muted-foreground">
          {t("recipes:form.amountHint")}
        </Text>
        {highlightMissing && missing > 0 && (
          <View className="flex-row gap-3 rounded-md bg-amber-100 p-3 dark:bg-amber-950">
            <Icon
              as={CircleAlert}
              className="text-amber-700 dark:text-amber-300"
            />
            <Text className="flex-1 text-amber-900 dark:text-amber-200">
              {t("recipes:form.missingAmounts", { count: missing })}
            </Text>
          </View>
        )}
        {draft.ingredients.map((ingredient, index) => {
          const empty = !ingredient.quantity.trim()
          const quantityError = errors[`ingredient.${ingredient.key}.quantity`]
          const nameError = errors[`ingredient.${ingredient.key}.name`]
          const name = ingredient.name.trim() || t("recipes:form.ingredientFallback", { n: index + 1 })
          return (
            <View
              key={ingredient.key}
              className="gap-2 border-b border-border pb-4"
            >
              <View className="flex-row gap-2">
                <Field
                  label={t("recipes:form.amount")}
                  value={ingredient.quantity}
                  keyboardType="numbers-and-punctuation"
                  className="w-24"
                  warn={!!quantityError || (highlightMissing && empty)}
                  onChangeText={(quantity) =>
                    setIngredient(ingredient.key, { quantity })
                  }
                />
                <Field
                  label={t("recipes:form.unit")}
                  value={ingredient.unit}
                  className="w-20"
                  autoCapitalize="none"
                  onChangeText={(unit) => setIngredient(ingredient.key, { unit })}
                />
                <Field
                  label={t("recipes:form.ingredient")}
                  value={ingredient.name}
                  className="flex-1"
                  warn={!!nameError}
                  onChangeText={(value) =>
                    setIngredient(ingredient.key, { name: value })
                  }
                />
              </View>
              <View className="flex-row gap-2">
                <Field
                  label={t("recipes:form.note")}
                  value={ingredient.note}
                  className="flex-1"
                  onChangeText={(note) => setIngredient(ingredient.key, { note })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  icon={Trash2}
                  label={t("recipes:form.remove", { name })}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      ingredients: d.ingredients.filter(
                        (i) => i.key !== ingredient.key
                      ),
                    }))
                  }
                />
              </View>
              <FieldError message={quantityError ?? nameError} />
              {highlightMissing && empty && !quantityError && (
                <Text className="text-sm text-amber-700 dark:text-amber-300">
                  {t("recipes:form.amountMissing")}
                </Text>
              )}
            </View>
          )
        })}
        <Button
          variant="outline"
          icon={Plus}
          label={t("recipes:form.addIngredient")}
          onPress={() =>
            setDraft((d) => ({
              ...d,
              ingredients: [
                ...d.ingredients,
                { key: newKey(), quantity: "", unit: "", name: "", note: "" },
              ],
            }))
          }
        />
      </Card>

      <Card className="gap-4 p-4">
        <SectionTitle>{t("recipes:form.steps")}</SectionTitle>
        <Text className="text-sm text-muted-foreground">
          {t("recipes:form.stepsHint")}
        </Text>
        {draft.steps.map((step, i) => (
          <View key={step.key} className="flex-row items-start gap-2">
            <Text className="w-6 pt-3 text-base font-semibold text-muted-foreground">
              {i + 1}
            </Text>
            <Field
              label={t("recipes:form.stepN", { n: i + 1 })}
              value={step.text}
              multiline
              textAlignVertical="top"
              className="h-auto min-h-20 flex-1 py-3"
              onChangeText={(text) => setStep(step.key, text)}
            />
            <Button
              variant="ghost"
              size="icon"
              icon={Trash2}
              label={t("recipes:form.removeStep", { n: i + 1 })}
              onPress={() =>
                setDraft((d) => ({
                  ...d,
                  steps: d.steps.filter((s) => s.key !== step.key),
                }))
              }
            />
          </View>
        ))}
        <Button
          variant="outline"
          icon={Plus}
          label={t("recipes:form.addStep")}
          onPress={() =>
            setDraft((d) => ({
              ...d,
              steps: [...d.steps, { key: newKey(), text: "" }],
            }))
          }
        />
      </Card>

      <Card className="gap-4 p-4">
        <SectionTitle>{t("recipes:form.nutrition")}</SectionTitle>
        <Text className="text-sm text-muted-foreground">
          {t("recipes:form.nutritionHint")}
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {(
            [
              "calories",
              "protein",
              "carbs",
              "fat",
            ] as const
          ).map((field) => (
            <View key={field} className="min-w-36 flex-1 gap-1.5">
              <Input
                label={t(`recipes:form.${field}`)}
                value={draft[field]}
                keyboardType="decimal-pad"
                onChangeText={(value) => set({ [field]: value })}
              />
              <FieldError message={errors[field]} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  )
}
