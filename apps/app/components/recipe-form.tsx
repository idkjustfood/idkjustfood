import { CircleAlert, Plus, Trash2 } from "lucide-react-native"
import { useRef, useState } from "react"
import { Text, TextInput, View } from "react-native"

import { Button } from "@/components/ui/button"
import { Card, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import type { Ingredient, Recipe, Step } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/** A compact input without a visible label, for rows of fields. */
function Field({
  label,
  value,
  onChangeText,
  className,
  warn,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; warn?: boolean }) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor="#737373"
      value={value}
      onChangeText={onChangeText}
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

type Draft = {
  title: string
  description: string
  servings: string
  ingredients: (Omit<Ingredient, "quantity"> & { quantity: string })[]
  steps: Step[]
}

function toDraft(recipe: Recipe): Draft {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: String(recipe.servings),
    ingredients: recipe.ingredients.map((i) => ({
      ...i,
      quantity: i.quantity === null ? "" : String(i.quantity),
    })),
    steps: recipe.steps,
  }
}

/**
 * The editable form for a recipe. Used to edit a saved recipe and to review an import.
 * With `highlightMissing`, ingredients without an amount are marked so the user can fill them in.
 * The form only changes local state; nothing is saved yet.
 */
export function RecipeForm({
  recipe,
  highlightMissing,
}: {
  recipe: Recipe
  highlightMissing?: boolean
}) {
  const [draft, setDraft] = useState(() => toDraft(recipe))
  const nextId = useRef(0)
  const newId = () => `new-${++nextId.current}`

  function setIngredient(
    id: string,
    patch: Partial<Draft["ingredients"][number]>
  ) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((i) =>
        i.id === id ? { ...i, ...patch } : i
      ),
    }))
  }

  function setStep(id: string, text: string) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.id === id ? { ...s, text } : s)),
    }))
  }

  const missing = draft.ingredients.filter((i) => !i.quantity.trim()).length

  return (
    <View className="gap-6">
      <Card className="gap-4 p-4">
        <Input
          label="Title"
          value={draft.title}
          onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
        />
        <Input
          label="Short description"
          value={draft.description}
          multiline
          className="h-24 py-3"
          textAlignVertical="top"
          onChangeText={(description) =>
            setDraft((d) => ({ ...d, description }))
          }
        />
        <Input
          label="Servings"
          value={draft.servings}
          keyboardType="number-pad"
          className="w-28"
          onChangeText={(servings) => setDraft((d) => ({ ...d, servings }))}
        />
      </Card>

      <Card className="gap-4 p-4">
        <SectionTitle>Ingredients</SectionTitle>
        {highlightMissing && missing > 0 && (
          <View className="flex-row gap-3 rounded-md bg-amber-100 p-3 dark:bg-amber-950">
            <Icon
              as={CircleAlert}
              className="text-amber-700 dark:text-amber-300"
            />
            <Text className="flex-1 text-amber-900 dark:text-amber-200">
              {missing} {missing === 1 ? "amount was" : "amounts were"} not in
              the video. We left {missing === 1 ? "it" : "them"} empty instead
              of guessing. Fill in what you know.
            </Text>
          </View>
        )}
        {draft.ingredients.map((ingredient) => {
          const empty = !ingredient.quantity.trim()
          return (
            <View
              key={ingredient.id}
              className="gap-2 border-b border-border pb-4"
            >
              <View className="flex-row gap-2">
                <Field
                  label="Amount"
                  value={ingredient.quantity}
                  keyboardType="decimal-pad"
                  className="w-24"
                  warn={highlightMissing && empty}
                  onChangeText={(quantity) =>
                    setIngredient(ingredient.id, { quantity })
                  }
                />
                <Field
                  label="Unit"
                  value={ingredient.unit ?? ""}
                  className="w-20"
                  onChangeText={(unit) =>
                    setIngredient(ingredient.id, { unit })
                  }
                />
                <Field
                  label="Ingredient"
                  value={ingredient.name}
                  className="flex-1"
                  onChangeText={(name) =>
                    setIngredient(ingredient.id, { name })
                  }
                />
              </View>
              <View className="flex-row gap-2">
                <Field
                  label="Note, for example “chopped”"
                  value={ingredient.note ?? ""}
                  className="flex-1"
                  onChangeText={(note) =>
                    setIngredient(ingredient.id, { note })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  icon={Trash2}
                  label={`Remove ${ingredient.name}`}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      ingredients: d.ingredients.filter(
                        (i) => i.id !== ingredient.id
                      ),
                    }))
                  }
                />
              </View>
              {highlightMissing && empty && (
                <Text className="text-sm text-amber-700 dark:text-amber-300">
                  Amount not given in the source
                </Text>
              )}
            </View>
          )
        })}
        <Button
          variant="outline"
          icon={Plus}
          label="Add ingredient"
          onPress={() =>
            setDraft((d) => ({
              ...d,
              ingredients: [
                ...d.ingredients,
                { id: newId(), name: "", quantity: "", unit: null },
              ],
            }))
          }
        />
      </Card>

      <Card className="gap-4 p-4">
        <SectionTitle>Steps</SectionTitle>
        {draft.steps.map((step, i) => (
          <View key={step.id} className="flex-row items-start gap-2">
            <Text className="w-6 pt-3 text-base font-semibold text-muted-foreground">
              {i + 1}
            </Text>
            <Field
              label={`Step ${i + 1}`}
              value={step.text}
              multiline
              textAlignVertical="top"
              className="h-auto min-h-20 flex-1 py-3"
              onChangeText={(text) => setStep(step.id, text)}
            />
            <Button
              variant="ghost"
              size="icon"
              icon={Trash2}
              label={`Remove step ${i + 1}`}
              onPress={() =>
                setDraft((d) => ({
                  ...d,
                  steps: d.steps.filter((s) => s.id !== step.id),
                }))
              }
            />
          </View>
        ))}
        <Button
          variant="outline"
          icon={Plus}
          label="Add step"
          onPress={() =>
            setDraft((d) => ({
              ...d,
              steps: [...d.steps, { id: newId(), text: "" }],
            }))
          }
        />
      </Card>
    </View>
  )
}
