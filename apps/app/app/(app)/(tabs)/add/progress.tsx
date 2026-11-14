import { router, useLocalSearchParams } from "expo-router"
import { Check } from "lucide-react-native"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { addMethods, isAddMethod } from "@/lib/add-methods"
import { useAppState } from "@/lib/app-state"
import { useExtractionJob } from "@/lib/extractions"
import { cn } from "@/lib/utils"

/**
 * "Working on it". The server tells us only if the job is running, done or failed, so the
 * steps below are a guide: they tick by while it works, and all finish when the recipe is ready.
 * In demo mode nothing is sent and the steps run on a timer.
 */
export default function Progress() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ method: string; job?: string }>()
  const method = isAddMethod(params.method) ? params.method : "video"
  const steps = addMethods[method].steps
  const { demo } = useAppState()
  const query = useExtractionJob(params.job)
  const job = query.data
  const [ticks, setTicks] = useState(0)

  const succeeded = demo ? ticks >= steps.length : job?.status === "succeeded"
  const recipeId = demo ? "imported" : job?.recipe?.id

  useEffect(() => {
    if (succeeded) return
    // While waiting, never tick past the last step: only the server says when it is done.
    if (!demo && ticks >= steps.length - 1) return
    const timeout = setTimeout(() => setTicks((t) => t + 1), demo ? 900 : 4000)
    return () => clearTimeout(timeout)
  }, [ticks, steps.length, demo, succeeded])

  useEffect(() => {
    if (job?.status === "failed") {
      router.replace({
        pathname: "/add/error",
        params: { reason: "failed", code: job.errorCode ?? undefined },
      })
    }
  }, [job?.status, job?.errorCode])

  const done = succeeded ? steps.length : ticks
  const lostJob = query.isError

  return (
    <Screen
      title={
        succeeded ? t("add:progress.readyTitle") : t("add:progress.workingTitle")
      }
      subtitle={
        succeeded
          ? t("add:progress.readySubtitle")
          : t("add:progress.workingSubtitle")
      }
      back="/add"
      narrow
      footer={
        succeeded ? (
          <Button
            label={t("add:progress.review")}
            onPress={() =>
              router.replace({
                pathname: "/add/review",
                params: { id: recipeId },
              })
            }
          />
        ) : (
          <View className="gap-3">
            {lostJob && (
              <Text role="alert" className="text-sm text-destructive">
                {t("add:progress.lostJob")}
              </Text>
            )}
            <Button
              variant="outline"
              label={t("add:progress.leave")}
              onPress={() => router.replace("/add")}
            />
          </View>
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
                {t(step)}
              </Text>
            </View>
          )
        })}
      </Card>
    </Screen>
  )
}
