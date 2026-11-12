import { Redirect, useLocalSearchParams } from "expo-router"
import { BookPlus, Link2, Plus, UserPlus, Users } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { OfflineBanner } from "@/components/offline-banner"
import { RecipeCover } from "@/components/recipe-card"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { SectionTitle } from "@/components/ui/card"
import { CheckboxBox } from "@/components/ui/checkbox"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { formatAmount } from "@/lib/format"
import { useHousehold, useMembers, useMyUserId } from "@/lib/households"
import { findShoppingList, recipes, type ShoppingItem } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export default function ShoppingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const list = findShoppingList(id)
  if (!list) return <Redirect href="/shopping" />
  return <ListView key={list.id} listId={list.id} />
}

function ListView({ listId }: { listId: string }) {
  const list = findShoppingList(listId)!
  const { units } = useAppState()
  const { household } = useHousehold()
  const members = useMembers(household?.id)
  const myUserId = useMyUserId()
  const [items, setItems] = useState(list.items)
  const [draft, setDraft] = useState("")
  const [shareOpen, setShareOpen] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState(false)

  const open = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)
  const categories = Array.from(new Set(open.map((i) => i.category)))

  function toggle(id: string) {
    setItems((all) =>
      all.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    )
  }

  function addItem() {
    const name = draft.trim()
    if (!name) return
    setItems((all) => [
      ...all,
      {
        id: `new-${Date.now()}`,
        name,
        quantity: null,
        unit: null,
        category: "Other",
        checked: false,
        fromRecipes: [],
      },
    ])
    setDraft("")
  }

  return (
    <Screen
      title={list.name}
      subtitle={`${open.length} to get · ${checked.length} done`}
      back="/shopping"
      narrow
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            icon={BookPlus}
            label="Add a recipe"
            onPress={() => setRecipeOpen(true)}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={UserPlus}
            label="Share list"
            onPress={() => setShareOpen(true)}
          />
        </>
      }
    >
      <OfflineBanner />

      <View className="flex-row gap-2">
        <TextInput
          accessibilityLabel="Add an item"
          placeholder="Add an item"
          placeholderTextColor="#737373"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addItem}
          returnKeyType="done"
          className="h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground"
        />
        <Button size="icon" icon={Plus} label="Add item" onPress={addItem} />
      </View>

      {categories.map((category) => (
        <View key={category} className="gap-1">
          <SectionTitle className="text-base text-muted-foreground">
            {category}
          </SectionTitle>
          {open
            .filter((i) => i.category === category)
            .map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                units={units}
                onToggle={() => toggle(item.id)}
              />
            ))}
        </View>
      ))}

      {checked.length > 0 && (
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <SectionTitle className="text-base text-muted-foreground">
              In the basket
            </SectionTitle>
            <Button
              variant="ghost"
              size="sm"
              label="Clear"
              onPress={() => setItems((all) => all.filter((i) => !i.checked))}
            />
          </View>
          {checked.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              units={units}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </View>
      )}

      <Sheet
        open={recipeOpen}
        onClose={() => setRecipeOpen(false)}
        title="Add a recipe's ingredients"
      >
        <Text className="text-muted-foreground">
          Same ingredients are merged, for example 200 g + 100 g flour becomes
          300 g.
        </Text>
        <View className="gap-2">
          {recipes.slice(0, 4).map((recipe) => (
            <Pressable
              key={recipe.id}
              role="button"
              onPress={() => setRecipeOpen(false)}
              className="h-14 flex-row items-center gap-3 overflow-hidden rounded-md border border-border active:bg-accent web:hover:bg-accent"
            >
              <RecipeCover recipe={recipe} className="h-full w-14" />
              <Text
                numberOfLines={1}
                className="flex-1 text-base text-foreground"
              >
                {recipe.title}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          variant="outline"
          label="Cancel"
          onPress={() => setRecipeOpen(false)}
        />
      </Sheet>

      <Sheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share this list"
      >
        <ListGroup>
          {household && (
            <ListRow
              icon={Users}
              title={`Share with ${household.name}`}
              detail={(members.data ?? [])
                .filter((m) => m.userId !== myUserId)
                .map((m) => m.name)
                .join(", ")}
              onPress={() => setShareOpen(false)}
            />
          )}
          <ListRow
            icon={Link2}
            title="Copy invite link"
            detail="Anyone with the link can edit"
            onPress={() => setShareOpen(false)}
          />
        </ListGroup>
        <Button
          variant="outline"
          label="Close"
          onPress={() => setShareOpen(false)}
        />
      </Sheet>
    </Screen>
  )
}

function ItemRow({
  item,
  units,
  onToggle,
}: {
  item: ShoppingItem
  units: "metric" | "imperial"
  onToggle: () => void
}) {
  const amount = formatAmount(item, 1, units)
  return (
    <Pressable
      role="checkbox"
      aria-checked={item.checked}
      onPress={onToggle}
      className="min-h-14 flex-row items-center gap-3 rounded-md px-1 py-2 active:bg-accent web:hover:bg-accent"
    >
      <CheckboxBox checked={item.checked} />
      <View className="flex-1 gap-0.5">
        <Text
          className={cn(
            "text-base",
            item.checked
              ? "text-muted-foreground line-through"
              : "text-foreground"
          )}
        >
          {amount && <Text className="font-semibold">{amount} </Text>}
          {item.name}
        </Text>
        {item.mergedFrom ? (
          <Text className="text-sm text-muted-foreground">
            {item.mergedFrom.join(" + ")} · from {item.fromRecipes.length}{" "}
            recipes
          </Text>
        ) : item.fromRecipes.length > 1 ? (
          <Text className="text-sm text-muted-foreground">
            For {item.fromRecipes.length} recipes, no amount given
          </Text>
        ) : item.fromRecipes[0] ? (
          <Text numberOfLines={1} className="text-sm text-muted-foreground">
            {item.fromRecipes[0]}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}
