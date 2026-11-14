import { Redirect, router, useLocalSearchParams } from "expo-router"
import {
  BookPlus,
  EllipsisVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"

import {
  parseQuantity,
  type ShoppingItem,
  type ShoppingList,
} from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { OfflineBanner } from "@/components/offline-banner"
import { RecipeCover } from "@/components/recipe-card"
import { Screen } from "@/components/screen"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { SectionTitle } from "@/components/ui/card"
import { CheckboxBox } from "@/components/ui/checkbox"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { formatAmount } from "@/lib/format"
import { isOwner, useHouseholdById, useMyUserId } from "@/lib/households"
import { useAllRecipes } from "@/lib/recipes"
import {
  useListKind,
  useShoppingActions,
  useShoppingList,
} from "@/lib/shopping"
import { cn } from "@/lib/utils"

export default function ShoppingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { list, loaded } = useShoppingList(id)
  if (!loaded) {
    return (
      <Screen title="Shopping list" back="/shopping" narrow>
        <LoadingState label="Loading list" rows={2} />
      </Screen>
    )
  }
  if (!list) return <Redirect href="/shopping" />
  return <ListView key={list.id} list={list} />
}

function ListView({ list }: { list: ShoppingList }) {
  const { units } = useAppState()
  const household = useHouseholdById(list.householdId)
  const myUserId = useMyUserId()
  const kindLabel = useListKind()(list)
  const actions = useShoppingActions()
  const [draft, setDraft] = useState("")
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState("")
  const [amountError, setAmountError] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)

  const open = list.items.filter((i) => !i.checked)
  const checked = list.items.filter((i) => i.checked)
  const canDelete =
    list.userId === myUserId || (!!list.householdId && isOwner(household?.role))

  function addItem() {
    const name = draft.trim()
    if (!name) return
    // An empty amount stays empty: it is never guessed.
    const quantity = parseQuantity(amount)
    if (quantity === undefined) {
      setAmountError(true)
      return
    }
    actions.addItem(list.id, {
      name,
      quantity,
      unit: quantity !== null && unit.trim() ? unit.trim() : null,
    })
    setDraft("")
    setAmount("")
    setUnit("")
    setAmountError(false)
  }

  return (
    <Screen
      title={list.name}
      subtitle={`${kindLabel} · ${open.length} to get · ${checked.length} done`}
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
            icon={EllipsisVertical}
            label="List options"
            onPress={() => setOptionsOpen(true)}
          />
        </>
      }
    >
      <OfflineBanner />

      <View className="gap-2">
        <View className="flex-row gap-2">
          <TextInput
            accessibilityLabel="Add an item"
            placeholder="Add an item"
            placeholderTextColor="#737373"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addItem}
            returnKeyType="done"
            maxLength={200}
            className="h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground"
          />
          <Button size="icon" icon={Plus} label="Add item" onPress={addItem} />
        </View>
        <View className="flex-row gap-2">
          <TextInput
            accessibilityLabel="Amount"
            placeholder="Amount (optional)"
            placeholderTextColor="#737373"
            value={amount}
            onChangeText={(text) => {
              setAmount(text)
              setAmountError(false)
            }}
            onSubmitEditing={addItem}
            keyboardType="numbers-and-punctuation"
            maxLength={12}
            aria-invalid={amountError}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-base text-foreground",
              amountError ? "border-destructive" : "border-input"
            )}
          />
          <TextInput
            accessibilityLabel="Unit"
            placeholder="Unit (g, ml, EL…)"
            placeholderTextColor="#737373"
            value={unit}
            onChangeText={setUnit}
            onSubmitEditing={addItem}
            autoCapitalize="none"
            maxLength={40}
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground"
          />
        </View>
        {amountError && (
          <Text role="alert" className="text-sm text-destructive">
            The amount must be a number, like 2, 1.5 or 1/2.
          </Text>
        )}
      </View>

      {list.items.length === 0 && (
        <Text className="text-muted-foreground">
          Nothing on this list yet. Type an item above, or add the ingredients
          of a recipe.
        </Text>
      )}

      {open.length > 0 && (
        <View className="gap-1">
          {open.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              units={units}
              onToggle={() =>
                actions.updateItem(list.id, item.id, { checked: true })
              }
              onRemove={() => actions.removeItem(list.id, item.id)}
            />
          ))}
        </View>
      )}

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
              onPress={() => actions.clearChecked(list.id)}
            />
          </View>
          {checked.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              units={units}
              onToggle={() =>
                actions.updateItem(list.id, item.id, { checked: false })
              }
              onRemove={() => actions.removeItem(list.id, item.id)}
            />
          ))}
        </View>
      )}

      <RecipeSheet
        list={list}
        open={recipeOpen}
        onClose={() => setRecipeOpen(false)}
      />
      <OptionsSheet
        list={list}
        open={optionsOpen}
        canDelete={canDelete}
        onClose={() => setOptionsOpen(false)}
      />
    </Screen>
  )
}

/** Pick one of the recipes that belong with this list and add its ingredients. */
function RecipeSheet({
  list,
  open,
  onClose,
}: {
  list: ShoppingList
  open: boolean
  onClose: () => void
}) {
  const actions = useShoppingActions()
  const recipes = useAllRecipes()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function add(recipeId: string, title: string) {
    setBusy(recipeId)
    setMessage(null)
    try {
      await actions.addRecipe(list.id, recipeId)
      onClose()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : `Could not add ${title}. Try again.`
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a recipe's ingredients">
      <Text className="text-muted-foreground">
        Same ingredients are merged, for example 200 g + 100 g flour becomes 300
        g. Amounts are for the recipe&apos;s own servings.
      </Text>
      {recipes.isPending && <LoadingState label="Loading recipes" rows={1} />}
      {recipes.isError && (
        <ErrorState
          title="Could not load recipes"
          message="Check your connection and try again."
          onRetry={() => void recipes.refetch()}
        />
      )}
      {recipes.data && recipes.data.length === 0 && (
        <Text className="text-foreground">You have no recipes yet.</Text>
      )}
      <View className="gap-2">
        {(recipes.data ?? []).map((recipe) => (
          <Pressable
            key={recipe.id}
            role="button"
            disabled={busy !== null}
            accessibilityLabel={`Add ${recipe.title}`}
            onPress={() => void add(recipe.id, recipe.title)}
            className={cn(
              "h-14 flex-row items-center gap-3 overflow-hidden rounded-md border border-border active:bg-accent web:hover:bg-accent",
              busy !== null && busy !== recipe.id && "opacity-50"
            )}
          >
            <RecipeCover recipe={recipe} className="h-full w-14" />
            <Text
              numberOfLines={1}
              className="flex-1 text-base text-foreground"
            >
              {recipe.title}
            </Text>
            {busy === recipe.id && (
              <Text className="pr-3 text-sm text-muted-foreground">
                Adding…
              </Text>
            )}
          </Pressable>
        ))}
      </View>
      {message && (
        <Text role="alert" className="text-sm text-destructive">
          {message}
        </Text>
      )}
      <Button variant="outline" label="Cancel" onPress={onClose} />
    </Sheet>
  )
}

function OptionsSheet({
  list,
  open,
  canDelete,
  onClose,
}: {
  list: ShoppingList
  open: boolean
  canDelete: boolean
  onClose: () => void
}) {
  const actions = useShoppingActions()
  const [mode, setMode] = useState<"menu" | "rename" | "delete">("menu")
  const [name, setName] = useState(list.name)

  function close() {
    setMode("menu")
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        mode === "rename"
          ? "Rename list"
          : mode === "delete"
            ? "Delete this list?"
            : "List options"
      }
    >
      {mode === "menu" && (
        <>
          <ListGroup>
            <ListRow
              icon={Pencil}
              title="Rename"
              onPress={() => {
                setName(list.name)
                setMode("rename")
              }}
            />
            {canDelete && (
              <ListRow
                icon={Trash2}
                title="Delete list"
                destructive
                onPress={() => setMode("delete")}
              />
            )}
          </ListGroup>
          <Button variant="outline" label="Close" onPress={close} />
        </>
      )}
      {mode === "rename" && (
        <>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label="Cancel"
              className="flex-1"
              onPress={() => setMode("menu")}
            />
            <Button
              label="Save"
              className="flex-1"
              disabled={!name.trim()}
              onPress={() => {
                actions.renameList(list.id, name.trim())
                close()
              }}
            />
          </View>
        </>
      )}
      {mode === "delete" && (
        <>
          <Text className="text-foreground">
            &quot;{list.name}&quot; and its {list.items.length} items will be
            deleted
            {list.householdId ? " for everyone in the household" : ""}. This
            cannot be undone.
          </Text>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label="Keep it"
              className="flex-1"
              onPress={() => setMode("menu")}
            />
            <Button
              variant="destructive"
              label="Delete"
              className="flex-1"
              onPress={() => {
                actions.deleteList(list.id)
                close()
                router.replace("/shopping")
              }}
            />
          </View>
        </>
      )}
    </Sheet>
  )
}

function ItemRow({
  item,
  units,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem
  units: "metric" | "imperial"
  onToggle: () => void
  onRemove: () => void
}) {
  const amount = formatAmount(item, 1, units)
  const recipes = item.fromRecipes
  return (
    <View className="min-h-14 flex-row items-center gap-1 rounded-md">
      <Pressable
        role="checkbox"
        aria-checked={item.checked}
        accessibilityLabel={item.name}
        onPress={onToggle}
        className="min-h-14 flex-1 flex-row items-center gap-3 rounded-md px-1 py-2 active:bg-accent web:hover:bg-accent"
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
            {item.note ? `, ${item.note}` : ""}
          </Text>
          {recipes.length > 1 ? (
            <Text className="text-sm text-muted-foreground">
              For {recipes.length} recipes
              {item.quantity === null ? ", no amount given" : ""}
            </Text>
          ) : recipes[0] ? (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {recipes[0]}
              {item.quantity === null ? " · no amount given" : ""}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        role="button"
        accessibilityLabel={`Remove ${item.name}`}
        onPress={onRemove}
        className="h-11 w-11 items-center justify-center rounded-md active:bg-accent web:hover:bg-accent"
      >
        <Icon as={X} size={18} className="text-muted-foreground" />
      </Pressable>
    </View>
  )
}
