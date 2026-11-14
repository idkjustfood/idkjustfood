import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { addDays } from "@workspace/schemas"

import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Sheet } from "@/components/ui/sheet"
import { useAddPlanToList } from "@/lib/planner"
import { weekLabel } from "@/lib/planner-format"
import {
  useListKind,
  useShoppingActions,
  useShoppingState,
} from "@/lib/shopping"
import { cn } from "@/lib/utils"

type Scope = "week" | "all"

/**
 * Puts the ingredients of the plan on a shopping list. Nothing is added until the
 * user taps the button here.
 */
export function AddToListSheet({
  planId,
  weekStart,
  mealsInWeek,
  onClose,
}: {
  planId: string
  weekStart: string
  /** How many meals are planned in the week being shown. */
  mealsInWeek: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { lists, loaded } = useShoppingState()
  const { sync } = useShoppingActions()
  const kind = useListKind()
  const add = useAddPlanToList(planId)
  const [scope, setScope] = useState<Scope>("week")
  const [listId, setListId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function submit() {
    if (!listId) return
    setMessage(null)
    try {
      const range =
        scope === "week" ? { from: weekStart, to: addDays(weekStart, 6) } : {}
      const result = await add.mutateAsync({ listId, ...range })
      // The list on this device is updated from the server.
      await sync()
      const name = lists.find((l) => l.id === listId)?.name ?? t("planner:list.theList")
      setDone(
        result.added === 0
          ? t("planner:list.nothing")
          : t("planner:list.added", { count: result.added, name })
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("planner:list.error")
      )
    }
  }

  return (
    <Sheet open onClose={onClose} title={t("planner:list.title")}>
      {done ? (
        <>
          <Text className="text-foreground">{done}</Text>
          <Button label={t("planner:list.done")} onPress={onClose} />
        </>
      ) : (
        <>
          <Text className="text-muted-foreground">
            {t("planner:list.intro")}
          </Text>
          <Segmented
            label={t("planner:list.whichMeals")}
            value={scope}
            onChange={setScope}
            options={[
              { value: "week", label: weekLabel(weekStart) },
              { value: "all", label: t("planner:list.wholePlan") },
            ]}
          />
          {scope === "week" && mealsInWeek === 0 && (
            <Text className="text-sm text-muted-foreground">
              {t("planner:list.weekEmpty")}
            </Text>
          )}
          <Text className="text-sm font-medium text-foreground">
            {t("planner:list.whichList")}
          </Text>
          {loaded && lists.length === 0 && (
            <Text className="text-muted-foreground">
              {t("planner:list.none")}
            </Text>
          )}
          <View className="gap-2">
            {lists.map((list) => {
              const selected = list.id === listId
              return (
                <Pressable
                  key={list.id}
                  role="radio"
                  aria-checked={selected}
                  onPress={() => setListId(list.id)}
                  className={cn(
                    "min-h-14 justify-center rounded-md border px-4 py-2 active:bg-accent",
                    selected ? "border-primary bg-primary/10" : "border-border"
                  )}
                >
                  <Text className="text-base text-foreground">{list.name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {kind(list)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          {message && (
            <Text role="alert" className="text-sm text-destructive">
              {message}
            </Text>
          )}
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label={t("planner:cancel")}
              className="flex-1"
              onPress={onClose}
            />
            <Button
              label={
                add.isPending ? t("planner:list.adding") : t("planner:list.add")
              }
              className="flex-1"
              disabled={!listId || add.isPending}
              onPress={() => void submit()}
            />
          </View>
        </>
      )}
    </Sheet>
  )
}
