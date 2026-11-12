import { router, useLocalSearchParams } from "expo-router"
import { Check } from "lucide-react-native"
import { useEffect, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { addMethods, isAddMethod } from "@/lib/add-methods"
import { cn } from "@/lib/utils"

/** "Working on it". In this prototype the steps tick by on a timer; nothing is sent anywhere. */
export default function Progress() {
  const params = useLocalSearchParams<{ method: string }>()
  const method = isAddMethod(params.method) ? params.method : "video"
  const steps = addMethods[method].steps
  const [done, setDone] = useState(0)

  useEffect(() => {
    if (done >= steps.length) return
    const timeout = setTimeout(() => setDone((d) => d + 1), 900)
    return () => clearTimeout(timeout)
  }, [done, steps.length])

  const finished = done >= steps.length

  return (
    <Screen
      title={finished ? "Recipe ready" : "Working on it…"}
      subtitle={
        finished
          ? "Check it before you save it."
          : "This takes up to a minute. You can leave this screen; we will let you know."
      }
      back="/add"
      narrow
      footer={
        finished ? (
          <Button
            label="Review recipe"
            onPress={() => router.replace("/add/review")}
          />
        ) : (
          <Button
            variant="outline"
            label="Cancel"
            onPress={() => router.replace("/add")}
          />
        )
      }
    >
      <Card className="gap-1 p-4">
        {steps.map((step, i) => {
          const state = i < done ? "done" : i === done ? "active" : "waiting"
          return (
            <View key={step} className="min-h-12 flex-row items-center gap-3">
              <View
                className={cn(
                  "h-7 w-7 items-center justify-center rounded-full",
                  state === "done" ? "bg-primary" : "bg-muted"
                )}
              >
                {state === "done" && (
                  <Icon
                    as={Check}
                    size={16}
                    strokeWidth={3}
                    className="text-primary-foreground"
                  />
                )}
                {state === "active" && <ActivityIndicator size="small" />}
              </View>
              <Text
                className={cn(
                  "text-base",
                  state === "waiting"
                    ? "text-muted-foreground"
                    : "text-foreground",
                  state === "active" && "font-semibold"
                )}
              >
                {step}
              </Text>
            </View>
          )
        })}
      </Card>
    </Screen>
  )
}
