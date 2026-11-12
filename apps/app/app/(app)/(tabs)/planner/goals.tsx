import { Text, View } from "react-native"

import { ComingSoon } from "@/components/coming-soon"
import { Screen } from "@/components/screen"
import { Card } from "@/components/ui/card"

const goals = [
  { label: "Calories", value: "2,200", unit: "kcal per day" },
  { label: "Protein", value: "120", unit: "g per day" },
  { label: "Carbs", value: "250", unit: "g per day" },
  { label: "Fat", value: "70", unit: "g per day" },
  { label: "Fibre", value: "30", unit: "g per day" },
]

/** Placeholder for nutrition goals. Not functional yet. */
export default function NutritionGoals() {
  return (
    <Screen title="Nutrition goals" back="/planner" narrow>
      <ComingSoon message="Set daily targets and the planner suggests a week that meets them. Values are always estimates." />
      <Card aria-disabled className="opacity-60">
        {goals.map((goal, i) => (
          <View
            key={goal.label}
            className={`min-h-14 flex-row items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
          >
            <Text className="text-base text-foreground">{goal.label}</Text>
            <Text className="text-base text-muted-foreground">
              <Text className="font-semibold text-foreground">
                {goal.value}
              </Text>{" "}
              {goal.unit}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  )
}
