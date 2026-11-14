import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { addDays } from "@workspace/schemas"

import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Sheet } from "@/components/ui/sheet"
import { useHousehold } from "@/lib/households"
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
  const { lists, loaded } = useShoppingState()
  const { sync } = useShoppingActions()
  const { household } = useHousehold()
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
      const name = lists.find((l) => l.id === listId)?.name ?? "the list"
      setDone(
        result.added === 0
          ? "There are no meals to add."
          : `Added the ingredients of ${result.added} ${result.added === 1 ? "meal" : "meals"} to ${name}.`
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add the ingredients."
      )
    }
  }

  return (
    <Sheet open onClose={onClose} title="Add ingredients to a shopping list">
      {done ? (
        <>
          <Text className="text-foreground">{done}</Text>
          <Button label="Done" onPress={onClose} />
        </>
      ) : (
        <>
          <Text className="text-muted-foreground">
            Amounts are scaled to the servings of each meal, and the same
            ingredients are merged. Nothing is added until you tap the button.
          </Text>
          <Segmented
            label="Which meals"
            value={scope}
            onChange={setScope}
            options={[
              { value: "week", label: weekLabel(weekStart) },
              { value: "all", label: "Whole plan" },
            ]}
          />
          {scope === "week" && mealsInWeek === 0 && (
            <Text className="text-sm text-muted-foreground">
              Nothing is planned in this week.
            </Text>
          )}
          <Text className="text-sm font-medium text-foreground">
            Which list?
          </Text>
          {loaded && lists.length === 0 && (
            <Text className="text-muted-foreground">
              You have no shopping lists yet. Make one in the Shopping tab.
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
                    {kind(list, household?.name)}
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
              label="Cancel"
              className="flex-1"
              onPress={onClose}
            />
            <Button
              label={add.isPending ? "Adding…" : "Add ingredients"}
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
