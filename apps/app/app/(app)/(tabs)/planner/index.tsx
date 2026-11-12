import { router } from "expo-router"
import { Target } from "lucide-react-native"
import { Text, useWindowDimensions, View } from "react-native"

import { ComingSoon } from "@/components/coming-soon"
import { RecipeCover } from "@/components/recipe-card"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { recipes } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]
// A sketch of a planned week, to show the idea.
const plan: (string | null)[] = [
  "lentil-dal",
  null,
  "tuscan-pasta",
  "chili-noodles",
  null,
  "smashed-potatoes",
  "greek-salad",
]

/** Placeholder for the meal planner. Not functional yet. */
export default function Planner() {
  // Seven columns only fit next to each other on a desktop.
  const wide = useWindowDimensions().width >= 1100

  return (
    <Screen
      title="Meal planner"
      actions={
        <Button
          variant="outline"
          size="sm"
          icon={Target}
          label="Goals"
          onPress={() => router.push("/planner/goals")}
        />
      }
    >
      <ComingSoon message="Plan your week, then get one shopping list for all of it. Later, nutrition goals help you balance the week." />
      <View
        aria-disabled
        className={cn("gap-3 opacity-60", wide && "flex-row")}
      >
        {days.map((day, i) => {
          const recipe = recipes.find((r) => r.id === plan[i])
          return (
            <View
              key={day}
              className={cn(
                "gap-2 rounded-lg border border-border bg-card p-3",
                wide ? "min-h-48 flex-1" : "flex-row items-center"
              )}
            >
              <Text
                className={cn("font-semibold text-foreground", !wide && "w-24")}
              >
                {day}
              </Text>
              {recipe ? (
                <View
                  className={cn(
                    "flex-1 gap-2",
                    !wide && "flex-row items-center"
                  )}
                >
                  <RecipeCover
                    recipe={recipe}
                    className={cn("rounded-md", wide ? "h-16" : "h-10 w-10")}
                  />
                  <Text
                    numberOfLines={2}
                    className="flex-1 text-sm text-foreground"
                  >
                    {recipe.title}
                  </Text>
                </View>
              ) : (
                <Text className="flex-1 text-sm text-muted-foreground">
                  Nothing planned
                </Text>
              )}
            </View>
          )
        })}
      </View>
    </Screen>
  )
}
