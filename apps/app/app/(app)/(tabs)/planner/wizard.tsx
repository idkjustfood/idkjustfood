import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Text, View } from "react-native"

import {
  mealSlots,
  slotLabels,
  todayString,
  weekStart,
  type GenerateResult,
  type MealSlot,
} from "@workspace/schemas"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import { Stepper } from "@/components/ui/stepper"
import { useGeneratePlan } from "@/lib/planner"
import { dayLabel } from "@/lib/planner-format"
import {
  emptyGoals,
  goalsProblem,
  plannedMeals,
  toGenerateRequest,
  wizardDays,
  type WizardDay,
  type WizardGoals,
} from "@/lib/planner-wizard"

const steps = ["Goals", "Days", "Result"] as const
const timeChoices = ["", "15", "30", "45", "60"]

/**
 * Fill a plan automatically in three steps: goals, which days and meals to plan
 * (with servings per day), and the result. The planner is plain code on the server,
 * so it works the same with any AI provider or none.
 */
export default function PlanWizard() {
  const params = useLocalSearchParams<{ planId?: string; start?: string }>()
  const planId = params.planId ?? ""
  const generate = useGeneratePlan(planId)

  const [step, setStep] = useState(0)
  const [goals, setGoals] = useState<WizardGoals>(emptyGoals)
  const [weeks, setWeeks] = useState(1)
  const [servings, setServings] = useState(2)
  const [replace, setReplace] = useState(false)
  const [days, setDays] = useState<WizardDay[]>([])
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const first = weekStart(params.start ?? todayString())
  const problem = goalsProblem(goals)

  function toDays() {
    if (problem) {
      setMessage(problem)
      return
    }
    setMessage(null)
    setDays(wizardDays(first, weeks, servings))
    setStep(1)
  }

  async function run() {
    setMessage(null)
    try {
      setResult(
        await generate.mutateAsync(
          toGenerateRequest(goals, days, servings, replace)
        )
      )
      setStep(2)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not fill the plan. Try again."
      )
    }
  }

  function change(date: string, update: (day: WizardDay) => WizardDay) {
    setDays((current) => current.map((d) => (d.date === date ? update(d) : d)))
  }

  const meals = plannedMeals(days)

  return (
    <Screen
      title="Auto-plan"
      subtitle={`Step ${step + 1} of 3 · ${steps[step]}`}
      back="/planner"
      narrow
      footer={
        <View className="gap-2">
          {message && (
            <Text role="alert" className="text-sm text-destructive">
              {message}
            </Text>
          )}
          {step === 0 && <Button label="Next: choose days" onPress={toDays} />}
          {step === 1 && (
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                label="Back"
                className="flex-1"
                onPress={() => setStep(0)}
              />
              <Button
                label={generate.isPending ? "Planning…" : "Fill my plan"}
                className="flex-1"
                disabled={meals === 0 || generate.isPending || !planId}
                onPress={() => void run()}
              />
            </View>
          )}
          {step === 2 && (
            <Button
              label="Open my plan"
              onPress={() => router.replace("/planner")}
            />
          )}
        </View>
      }
    >
      {!planId && (
        <Text role="alert" className="text-destructive">
          Open the planner and choose a plan first.
        </Text>
      )}

      {step === 0 && (
        <GoalsStep
          goals={goals}
          onGoals={setGoals}
          weeks={weeks}
          onWeeks={setWeeks}
          servings={servings}
          onServings={setServings}
          replace={replace}
          onReplace={setReplace}
        />
      )}
      {step === 1 && (
        <View className="gap-3">
          <Text className="text-muted-foreground">
            Skip days or single meals, and change the servings for a day.
            Skipped meals stay empty.
          </Text>
          {days.map((day) => (
            <DayRow key={day.date} day={day} onChange={change} />
          ))}
        </View>
      )}
      {step === 2 && result && <ResultStep result={result} />}
    </Screen>
  )
}

function GoalsStep({
  goals,
  onGoals,
  weeks,
  onWeeks,
  servings,
  onServings,
  replace,
  onReplace,
}: {
  goals: WizardGoals
  onGoals: (goals: WizardGoals) => void
  weeks: number
  onWeeks: (weeks: number) => void
  servings: number
  onServings: (servings: number) => void
  replace: boolean
  onReplace: (replace: boolean) => void
}) {
  const set = (patch: Partial<WizardGoals>) => onGoals({ ...goals, ...patch })
  return (
    <View className="gap-5">
      <Text className="text-muted-foreground">
        Tell the planner what you want. It picks from your saved recipes, and
        never invents a meal. Leave a goal empty to ignore it.
      </Text>
      <View className="gap-1.5">
        <Input
          label="Calories per day (per person)"
          value={goals.calories}
          onChangeText={(calories) => set({ calories })}
          keyboardType="number-pad"
          placeholder="For example 2000"
          maxLength={5}
        />
        <Text className="text-sm text-muted-foreground">
          Uses the nutrition estimates of your recipes. Recipes without an
          estimate are left out when you set this.
        </Text>
      </View>
      <View className="gap-2">
        <Input
          label="Diet (a tag on the recipe)"
          value={goals.diet}
          onChangeText={(diet) => set({ diet })}
          placeholder="For example vegetarian"
          autoCapitalize="none"
          maxLength={40}
        />
        <View className="flex-row flex-wrap gap-2">
          {["vegetarian", "vegan"].map((diet) => (
            <Chip
              key={diet}
              label={diet[0]!.toUpperCase() + diet.slice(1)}
              selected={goals.diet.trim().toLowerCase() === diet}
              onPress={() =>
                set({
                  diet: goals.diet.trim().toLowerCase() === diet ? "" : diet,
                })
              }
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          Longest time per meal
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {timeChoices.map((minutes) => (
            <Chip
              key={minutes || "any"}
              label={minutes ? `${minutes} min` : "Any"}
              selected={goals.maxMinutes === minutes}
              onPress={() => set({ maxMinutes: minutes })}
            />
          ))}
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-base text-foreground">How many weeks</Text>
        <Stepper label="Weeks" value={weeks} max={4} onChange={onWeeks} />
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-base text-foreground">
          Servings per meal
        </Text>
        <Stepper
          label="Servings"
          value={servings}
          max={100}
          onChange={onServings}
        />
      </View>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          Meals you already planned
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Chip
            label="Keep them"
            selected={!replace}
            onPress={() => onReplace(false)}
          />
          <Chip
            label="Replace them"
            selected={replace}
            onPress={() => onReplace(true)}
          />
        </View>
      </View>
    </View>
  )
}

function DayRow({
  day,
  onChange,
}: {
  day: WizardDay
  onChange: (date: string, update: (day: WizardDay) => WizardDay) => void
}) {
  const toggleSlot = (slot: MealSlot) =>
    onChange(day.date, (d) => ({
      ...d,
      slots: { ...d.slots, [slot]: !d.slots[slot] },
    }))
  return (
    <View className="gap-3 rounded-lg border border-border bg-card p-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-base font-semibold text-foreground">
          {dayLabel(day.date)}
        </Text>
        <Chip
          label={day.plan ? "Planned" : "Skipped"}
          selected={day.plan}
          onPress={() => onChange(day.date, (d) => ({ ...d, plan: !d.plan }))}
        />
      </View>
      {day.plan && (
        <>
          <View className="flex-row flex-wrap gap-2">
            {mealSlots.map((slot) => (
              <Chip
                key={slot}
                label={slotLabels[slot]}
                selected={day.slots[slot]}
                onPress={() => toggleSlot(slot)}
              />
            ))}
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-foreground">Servings</Text>
            <Stepper
              label="Servings"
              value={day.servings}
              max={100}
              onChange={(servings) =>
                onChange(day.date, (d) => ({ ...d, servings }))
              }
            />
          </View>
        </>
      )}
    </View>
  )
}

function ResultStep({ result }: { result: GenerateResult }) {
  const { unfilled, notes } = result
  return (
    <View className="gap-4">
      <Text role="heading" className="text-xl font-semibold text-foreground">
        {unfilled.length === 0
          ? "Your plan is filled"
          : "Your plan is partly filled"}
      </Text>
      <Text className="text-foreground">
        {unfilled.length === 0
          ? "Every meal you asked for has a recipe. You can change any of them by hand in the plan."
          : `${unfilled.length} ${unfilled.length === 1 ? "meal stayed" : "meals stayed"} empty because no saved recipe matches. Save more recipes, or loosen your goals and try again.`}
      </Text>
      {notes.length > 0 && (
        <View className="gap-1 rounded-lg border border-border bg-muted p-3">
          {notes.map((note) => (
            <Text key={note} className="text-sm text-foreground">
              {note}
            </Text>
          ))}
        </View>
      )}
      {unfilled.length > 0 && (
        <View className="overflow-hidden rounded-lg border border-border bg-card">
          {unfilled.map((item, i) => (
            <View
              key={`${item.date}-${item.slot}`}
              className={`gap-0.5 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <Text className="text-base text-foreground">
                {dayLabel(item.date)} · {slotLabels[item.slot]}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {item.reason}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
