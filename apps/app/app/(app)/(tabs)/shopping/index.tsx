import { router } from "expo-router"
import { Plus, ShoppingCart, Users } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import type { ShoppingList } from "@workspace/schemas"

import { Grid } from "@/components/grid"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { useHousehold } from "@/lib/households"
import {
  useListKind,
  useShoppingActions,
  useShoppingState,
} from "@/lib/shopping"

type Kind = "personal" | "household"

export default function ShoppingLists() {
  const { space } = useAppState()
  const { household } = useHousehold()
  const { lists, loaded, error } = useShoppingState()
  const { createList, sync } = useShoppingActions()
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<Kind>(space)

  // Without a household, every list is a personal one.
  const chosen: Kind = household ? kind : "personal"

  function openNew() {
    setKind(space)
    setNewOpen(true)
  }

  function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = createList(
      trimmed,
      chosen === "household" && household ? household.id : null
    )
    setNewOpen(false)
    setName("")
    router.push(`/shopping/${id}`)
  }

  return (
    <Screen
      title="Shopping"
      actions={
        <Button size="sm" icon={Plus} label="New list" onPress={openNew} />
      }
    >
      <OfflineBanner />
      {!loaded && !error && <LoadingState label="Loading lists" rows={2} />}
      {!loaded && error && (
        <ErrorState
          title="Could not load your lists"
          message="Your lists are saved on this phone once they have loaded. Try again when you are online."
          onRetry={() => void sync()}
        />
      )}
      {loaded && lists.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title="No shopping lists yet"
          message="Make a list, then add the ingredients of a recipe with one tap."
          action="New list"
          onAction={openNew}
        />
      )}
      {loaded && lists.length > 0 && (
        <Grid
          items={lists}
          keyOf={(l) => l.id}
          render={(l) => <ListCard list={l} householdName={household?.name} />}
        />
      )}

      <Sheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New shopping list"
      >
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Weekly shop"
          maxLength={100}
          autoFocus
          onSubmitEditing={create}
        />
        {household && (
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">
              Who is it for?
            </Text>
            <Segmented
              label="Who is it for?"
              value={chosen}
              onChange={setKind}
              options={[
                { value: "personal", label: "Personal" },
                { value: "household", label: household.name },
              ]}
            />
            <Text className="text-sm text-muted-foreground">
              {chosen === "household"
                ? `Everyone in ${household.name} can see and change this list.`
                : "Only you can see this list."}
            </Text>
          </View>
        )}
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            label="Cancel"
            className="flex-1"
            onPress={() => setNewOpen(false)}
          />
          <Button
            label="Create"
            className="flex-1"
            disabled={!name.trim()}
            onPress={create}
          />
        </View>
      </Sheet>
    </Screen>
  )
}

function ListCard({
  list,
  householdName,
}: {
  list: ShoppingList
  householdName: string | undefined
}) {
  const kindLabel = useListKind()(list, householdName)
  const done = list.items.filter((i) => i.checked).length
  const total = list.items.length
  return (
    <Pressable
      role="link"
      accessibilityLabel={`${list.name}, ${kindLabel} list`}
      onPress={() => router.push(`/shopping/${list.id}`)}
      className="flex-1 gap-3 rounded-lg border border-border bg-card p-4 active:opacity-80 web:hover:border-ring"
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-lg font-semibold text-foreground">
          {list.name}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {done} of {total}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-muted">
        <View
          className="h-full rounded-full bg-primary"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </View>
      <View className="flex-row items-center gap-2">
        {list.householdId && (
          <Icon as={Users} size={16} className="text-muted-foreground" />
        )}
        <Badge
          label={kindLabel}
          variant={list.householdId ? "default" : "outline"}
        />
      </View>
    </Pressable>
  )
}
