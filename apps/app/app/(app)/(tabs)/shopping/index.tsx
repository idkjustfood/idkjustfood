import { router } from "expo-router"
import { Plus, ShoppingCart, Users } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { Grid } from "@/components/grid"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { useIsWide } from "@/lib/layout"
import { shoppingLists, type ShoppingList } from "@/lib/mock-data"

export default function ShoppingLists() {
  const wide = useIsWide()
  const { space, listState, setListState } = useAppState()
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState("")

  const lists =
    listState === "empty" ? [] : shoppingLists.filter((l) => l.space === space)

  return (
    <Screen
      title="Shopping"
      actions={
        <Button
          size="sm"
          icon={Plus}
          label="New list"
          onPress={() => setNewOpen(true)}
        />
      }
      toolbar={!wide ? <SpaceSwitcher /> : undefined}
    >
      <OfflineBanner />
      {listState === "loading" && (
        <LoadingState label="Loading lists" rows={2} />
      )}
      {listState === "error" && (
        <ErrorState
          title="Could not load your lists"
          message="Your lists are saved on this phone. Try again when you are online."
          onRetry={() => setListState("ready")}
        />
      )}
      {listState !== "loading" &&
        listState !== "error" &&
        lists.length === 0 && (
          <EmptyState
            icon={ShoppingCart}
            title="No shopping lists yet"
            message="Make a list, then add the ingredients of a recipe with one tap."
            action="New list"
            onAction={() => setNewOpen(true)}
          />
        )}
      {listState !== "loading" && listState !== "error" && lists.length > 0 && (
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
        />
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
            onPress={() => {
              setNewOpen(false)
              setName("")
            }}
          />
        </View>
      </Sheet>
    </Screen>
  )
}

function ListCard({ list }: { list: ShoppingList }) {
  const done = list.items.filter((i) => i.checked).length
  const total = list.items.length
  return (
    <Pressable
      role="link"
      accessibilityLabel={list.name}
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
        {list.sharedWith.length > 0 && (
          <Icon as={Users} size={16} className="text-muted-foreground" />
        )}
        <Text className="flex-1 text-sm text-muted-foreground">
          {list.sharedWith.length > 0
            ? `With ${list.sharedWith.join(", ")} · `
            : ""}
          {list.updated}
        </Text>
      </View>
    </Pressable>
  )
}
