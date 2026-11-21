import { Redirect, router, useLocalSearchParams } from "expo-router"
import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Mic,
  MicOff,
  X,
} from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { findTimers, stepsInOrder } from "@workspace/schemas"

import {
  IngredientList,
  SectionHeading,
  StepText,
  StepTimers,
} from "@/components/recipe-parts"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { activeTimers, firstIdle, startTimer, stopTimer } from "@/lib/cook-timers"
import { useRecipe, type Recipe } from "@/lib/recipes"
import { useKeepScreenOn } from "@/lib/use-keep-awake"
import { useVoiceControl } from "@/lib/use-voice-control"
import { cn } from "@/lib/utils"
import type { VoiceCommand } from "@/lib/voice-commands"

/** One step at a time, big text, easy to use with messy hands. */
export default function CookingMode() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useRecipe(id)

  if (query.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-background p-4">
        <LoadingState label={t("recipes:detail.loading")} rows={1} />
      </SafeAreaView>
    )
  }
  if (query.isError) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-background p-4">
        <ErrorState
          title={t("recipes:errors.loadRecipe")}
          message={t("recipes:errors.checkConnection")}
          onRetry={() => void query.refetch()}
        />
        <Button
          variant="ghost"
          label={t("recipes:cook.close")}
          onPress={() => router.replace("/recipes")}
        />
      </SafeAreaView>
    )
  }
  if (query.data.steps.length === 0) return <Redirect href={`/recipe/${query.data.id}`} />
  return <Cooking recipe={query.data} />
}

function Cooking({ recipe }: { recipe: Recipe }) {
  const { t, i18n } = useTranslation()
  const { units } = useAppState()
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [ingredientsOpen, setIngredientsOpen] = useState(false)

  // The steps in the order they are cooked, each with its section (if any).
  const ordered = useMemo(() => stepsInOrder(recipe.steps), [recipe.steps])
  const current = ordered[index]!
  const step = current.step
  const last = index === ordered.length - 1
  const close = () =>
    router.canGoBack() ? router.back() : router.replace(`/recipe/${recipe.id}`)

  // The screen stays on while cooking mode is open.
  const { unsupported: noWakeLock } = useKeepScreenOn()

  const scroller = useRef<ScrollViewInstance>(null)
  const [heard, setHeard] = useState<VoiceCommand | null>(null)
  const heardTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(heardTimer.current), [])

  function runCommand(command: VoiceCommand) {
    clearTimeout(heardTimer.current)
    setHeard(command)
    heardTimer.current = setTimeout(() => setHeard(null), 1500)
    const timers = findTimers(step.text)
    const ids = timers.map((_, n) => `${recipe.id}:${index}:${n}`)
    switch (command) {
      case "next":
        setIndex((i) => Math.min(i + 1, ordered.length - 1))
        break
      case "back":
        setIndex((i) => Math.max(i - 1, 0))
        break
      case "repeat":
        scroller.current?.scrollTo({ y: 0, animated: true })
        break
      case "startTimer": {
        const id = firstIdle(ids)
        if (id !== null) startTimer(id, timers[ids.indexOf(id)]!.seconds)
        break
      }
      case "stopTimer":
        activeTimers(ids).forEach(stopTimer)
        break
    }
  }

  const voice = useVoiceControl({
    enabled: listening,
    language: i18n.language,
    onCommand: runCommand,
  })
  const blocked =
    voice.status === "denied" ||
    voice.status === "unsupported" ||
    voice.status === "error"
  // Turn the switch off again when listening cannot go on.
  useEffect(() => {
    if (blocked) setListening(false)
  }, [blocked])
  const voiceNote =
    voice.supported === false
      ? t("recipes:cook.voiceUnsupported")
      : voice.status === "denied"
        ? t("recipes:cook.voiceDenied")
        : voice.status === "unsupported"
          ? t("recipes:cook.voiceLanguage")
          : voice.status === "error"
            ? t("recipes:cook.voiceError")
            : null

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-3xl flex-1 self-center px-4 md:px-8">
        <View className="flex-row items-center gap-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            icon={X}
            label={t("recipes:cook.closeCooking")}
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
              {t("recipes:cook.step", {
                current: index + 1,
                total: ordered.length,
              })}
            </Text>
          </View>
          <Button
            variant="ghost"
            size="icon"
            icon={ListChecks}
            label={t("recipes:cook.showIngredients")}
            onPress={() => setIngredientsOpen(true)}
          />
        </View>

        <View
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={ordered.length}
          aria-valuenow={index + 1}
          className="h-2 flex-row gap-1"
        >
          {ordered.map((s, i) => (
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
          ref={scroller}
          className="flex-1"
          contentContainerClassName="flex-grow justify-center gap-8 py-8"
        >
          {current.section && <SectionHeading name={current.section} />}
          <StepText
            text={step.text}
            ingredients={recipe.ingredients}
            className="text-3xl font-normal leading-tight text-foreground md:text-4xl"
            boldClassName="font-extrabold"
            live
          />
          <StepTimers
            recipeId={recipe.id}
            index={index}
            text={step.text}
            large
          />
        </ScrollView>

        {noWakeLock && (
          <Text className="mb-2 text-center text-sm text-muted-foreground">
            {t("recipes:cook.wakeLockUnsupported")}
          </Text>
        )}
        {voiceNote && (
          <Text
            role="alert"
            className="mb-2 text-center text-sm text-destructive"
          >
            {voiceNote}
          </Text>
        )}
        <Pressable
          role="switch"
          aria-checked={listening}
          aria-disabled={voice.supported === false}
          disabled={voice.supported === false}
          onPress={() => setListening((l) => !l)}
          className={cn(
            "mb-3 h-12 flex-row items-center justify-center gap-2 self-center rounded-full px-5",
            listening ? "bg-primary/15" : "bg-muted",
            voice.supported === false && "opacity-50"
          )}
        >
          <Icon
            as={listening ? Mic : MicOff}
            className={listening ? "text-primary" : "text-muted-foreground"}
          />
          <Text
            aria-live="polite"
            className={cn(
              "font-medium",
              listening ? "text-primary" : "text-muted-foreground"
            )}
          >
            {heard
              ? t(`recipes:cook.heard.${heard}`)
              : listening
                ? t("recipes:cook.listening")
                : t("recipes:cook.voiceOff")}
          </Text>
        </Pressable>

        <View className="flex-row gap-3 pb-4">
          <Button
            variant="outline"
            size="lg"
            icon={ChevronLeft}
            label={t("recipes:cook.back")}
            className="h-16 flex-1"
            disabled={index === 0}
            onPress={() => setIndex((i) => i - 1)}
          />
          <Button
            size="lg"
            icon={last ? undefined : ChevronRight}
            label={last ? t("recipes:cook.done") : t("recipes:cook.next")}
            className="h-16 flex-[2]"
            onPress={() => (last ? close() : setIndex((i) => i + 1))}
          />
        </View>
      </View>

      <Sheet
        open={ingredientsOpen}
        onClose={() => setIngredientsOpen(false)}
        title={t("recipes:cook.ingredients")}
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
          label={t("recipes:cook.close")}
          onPress={() => setIngredientsOpen(false)}
        />
      </Sheet>
    </SafeAreaView>
  )
}
