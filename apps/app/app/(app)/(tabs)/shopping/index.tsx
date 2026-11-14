import { router } from "expo-router"
import { Plus, ShoppingCart, Users } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import type { ShoppingList } from "@workspace/schemas"

import { Grid } from "@/components/grid"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { useHousehold } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { inSpace } from "@/lib/space"
import {
  useListKind,
  useShoppingActions,
  useShoppingState,
} from "@/lib/shopping"

export default function ShoppingLists() {
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const { lists: allLists, loaded, error } = useShoppingState()
  const { createList, sync } = useShoppingActions()
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState("")

  // Only the lists of the selected space: personal ones, or one household's.
  const lists = inSpace(allLists, household?.id ?? null)

  function create() {
    const trimmed = name.trim()
    if (!trimmed || !ready) return
    const id = createList(trimmed, household?.id ?? null)
    setNewOpen(false)
    setName("")
    router.push(`/shopping/${id}`)
  }

  return (
    <Screen
      title="Shopping"
      subtitle={household ? `Shared with ${household.name}` : "Your own lists"}
      toolbar={!wide && <SpaceSwitcher />}
      actions={
        <Button
          size="sm"
          icon={Plus}
          label="New list"
          onPress={() => setNewOpen(true)}
        />
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
          onAction={() => setNewOpen(true)}
        />
      )}
      {loaded && lists.length > 0 && (
        <Grid
          items={lists}
          keyOf={(l) => l.id}
          render={(l) => <ListCard list={l} />}
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
        <Text className="text-sm text-muted-foreground">
          {household
            ? `Everyone in ${household.name} can see and change this list.`
            : "Only you can see this list."}
        </Text>
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
            disabled={!name.trim() || !ready}
            onPress={create}
          />
        </View>
      </Sheet>
    </Screen>
  )
}

function ListCard({ list }: { list: ShoppingList }) {
  const kindLabel = useListKind()(list)
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
