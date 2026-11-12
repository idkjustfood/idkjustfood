import { Redirect, router, useLocalSearchParams } from "expo-router"
import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Mic,
  MicOff,
  X,
} from "lucide-react-native"
import { useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { IngredientList, StepTimers } from "@/components/recipe-parts"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { useRecipe, type Recipe } from "@/lib/recipes"
import { cn } from "@/lib/utils"

/** One step at a time, big text, easy to use with messy hands. */
export default function CookingMode() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useRecipe(id)

  if (query.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-background p-4">
        <LoadingState label="Loading recipe" rows={1} />
      </SafeAreaView>
    )
  }
  if (query.isError) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-background p-4">
        <ErrorState
          title="Could not load this recipe"
          message="Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
        <Button
          variant="ghost"
          label="Close"
          onPress={() => router.replace("/")}
        />
      </SafeAreaView>
    )
  }
  if (query.data.steps.length === 0) return <Redirect href={`/recipe/${query.data.id}`} />
  return <Cooking recipe={query.data} />
}

function Cooking({ recipe }: { recipe: Recipe }) {
  const { units } = useAppState()
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [ingredientsOpen, setIngredientsOpen] = useState(false)

  const step = recipe.steps[index]
  const last = index === recipe.steps.length - 1
  const close = () =>
    router.canGoBack() ? router.back() : router.replace(`/recipe/${recipe.id}`)

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-3xl flex-1 self-center px-4 md:px-8">
        <View className="flex-row items-center gap-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            icon={X}
            label="Close cooking mode"
            className="-ml-3"
            onPress={close}
          />
          <View className="flex-1">
            <Text
              numberOfLines={1}
              className="text-base font-semibold text-foreground"
            >
              {recipe.title}
            </Text>
            <Text className="text-sm text-muted-foreground">
              Step {index + 1} of {recipe.steps.length}
            </Text>
          </View>
          <Button
            variant="ghost"
            size="icon"
            icon={ListChecks}
            label="Show ingredients"
            onPress={() => setIngredientsOpen(true)}
          />
        </View>

        <View
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={recipe.steps.length}
          aria-valuenow={index + 1}
          className="h-2 flex-row gap-1"
        >
          {recipe.steps.map((s, i) => (
            <View
              key={i}
              className={cn(
                "flex-1 rounded-full",
                i <= index ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center gap-8 py-8"
        >
          <Text
            aria-live="polite"
            className="text-3xl font-semibold leading-tight text-foreground md:text-4xl"
          >
            {step!.text}
          </Text>
          <StepTimers
            recipeId={recipe.id}
            index={index}
            text={step!.text}
            large
          />
        </ScrollView>

        <Pressable
          role="switch"
          aria-checked={listening}
          onPress={() => setListening((l) => !l)}
          className={cn(
            "mb-3 h-12 flex-row items-center justify-center gap-2 self-center rounded-full px-5",
            listening ? "bg-primary/15" : "bg-muted"
          )}
        >
          <Icon
            as={listening ? Mic : MicOff}
            className={listening ? "text-primary" : "text-muted-foreground"}
          />
          <Text
            className={cn(
              "font-medium",
              listening ? "text-primary" : "text-muted-foreground"
            )}
          >
            {listening
              ? "Listening: say “next” or “back”"
              : "Voice control off"}
          </Text>
        </Pressable>

        <View className="flex-row gap-3 pb-4">
          <Button
            variant="outline"
            size="lg"
            icon={ChevronLeft}
            label="Back"
            className="h-16 flex-1"
            disabled={index === 0}
            onPress={() => setIndex((i) => i - 1)}
          />
          <Button
            size="lg"
            icon={last ? undefined : ChevronRight}
            label={last ? "Done" : "Next"}
            className="h-16 flex-[2]"
            onPress={() => (last ? close() : setIndex((i) => i + 1))}
          />
        </View>
      </View>

      <Sheet
        open={ingredientsOpen}
        onClose={() => setIngredientsOpen(false)}
        title="Ingredients"
      >
        <ScrollView className="max-h-96">
          <IngredientList
            ingredients={recipe.ingredients}
            factor={1}
            units={units}
          />
        </ScrollView>
        <Button
          variant="outline"
          label="Close"
          onPress={() => setIngredientsOpen(false)}
        />
      </Sheet>
    </SafeAreaView>
  )
}
