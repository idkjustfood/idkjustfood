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
import { useTranslation } from "react-i18next"
import { Pressable, Text, TextInput, View } from "react-native"

import {
  parseQuantity,
  type ShoppingItem,
  type ShoppingList,
  type UnitKey,
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
import { UnitPicker } from "@/components/ui/unit-picker"
import { useAppState } from "@/lib/app-state"
import { formatAmount } from "@/lib/format"
import { isOwner, useHouseholdById, useMyUserId } from "@/lib/households"
import { useAllRecipes } from "@/lib/recipes"
import { OfflineError } from "@/lib/shopping-store"
import {
  useListKind,
  useShoppingActions,
  useShoppingList,
} from "@/lib/shopping"
import { cn } from "@/lib/utils"

export default function ShoppingListScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { list, loaded } = useShoppingList(id)
  if (!loaded) {
    return (
      <Screen title={t("shopping:list.title")} back="/shopping" narrow>
        <LoadingState label={t("shopping:list.loading")} rows={2} />
      </Screen>
    )
  }
  if (!list) return <Redirect href="/shopping" />
  return <ListView key={list.id} list={list} />
}

function ListView({ list }: { list: ShoppingList }) {
  const { t } = useTranslation()
  const { units } = useAppState()
  const household = useHouseholdById(list.householdId)
  const myUserId = useMyUserId()
  const kindLabel = useListKind()(list)
  const actions = useShoppingActions()
  const [draft, setDraft] = useState("")
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState<UnitKey | null>(null)
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
      unit: quantity !== null ? unit : null,
    })
    setDraft("")
    setAmount("")
    setUnit(null)
    setAmountError(false)
  }

  return (
    <Screen
      title={list.name}
      subtitle={t("shopping:list.subtitle", {
        kind: kindLabel,
        open: open.length,
        done: checked.length,
      })}
      back="/shopping"
      narrow
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            icon={BookPlus}
            label={t("shopping:list.addRecipe")}
            onPress={() => setRecipeOpen(true)}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={EllipsisVertical}
            label={t("shopping:options.title")}
            onPress={() => setOptionsOpen(true)}
          />
        </>
      }
    >
      <OfflineBanner />

      <View className="gap-2">
        <View className="flex-row gap-2">
          <TextInput
            accessibilityLabel={t("shopping:list.addItem")}
            placeholder={t("shopping:list.addItem")}
            placeholderTextColor="#737373"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addItem}
            returnKeyType="done"
            maxLength={200}
            className="h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground"
          />
          <Button size="icon" icon={Plus} label={t("shopping:list.addItemButton")} onPress={addItem} />
        </View>
        <View className="flex-row gap-2">
          <TextInput
            accessibilityLabel={t("shopping:list.amount")}
            placeholder={t("shopping:list.amountPlaceholder")}
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
          <UnitPicker
            label={t("shopping:list.unit")}
            value={unit}
            onChange={setUnit}
            className="h-11 min-w-0 flex-1"
          />
        </View>
        {amountError && (
          <Text role="alert" className="text-sm text-destructive">
            {t("shopping:list.amountError")}
          </Text>
        )}
      </View>

      {list.items.length === 0 && (
        <Text className="text-muted-foreground">
          {t("shopping:list.empty")}
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
              {t("shopping:list.inBasket")}
            </SectionTitle>
            <Button
              variant="ghost"
              size="sm"
              label={t("shopping:list.clear")}
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
  const { t } = useTranslation()
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
        error instanceof OfflineError
          ? t("shopping:recipe.offline")
          : error instanceof Error && error.message
            ? error.message
            : t("shopping:recipe.addError", { title })
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("shopping:recipe.title")}>
      <Text className="text-muted-foreground">
        {t("shopping:recipe.hint")}
      </Text>
      {recipes.isPending && <LoadingState label={t("shopping:recipe.loading")} rows={1} />}
      {recipes.isError && (
        <ErrorState
          title={t("shopping:recipe.loadError.title")}
          message={t("shopping:recipe.loadError.message")}
          onRetry={() => void recipes.refetch()}
        />
      )}
      {recipes.data && recipes.data.length === 0 && (
        <Text className="text-foreground">{t("shopping:recipe.none")}</Text>
      )}
      <View className="gap-2">
        {(recipes.data ?? []).map((recipe) => (
          <Pressable
            key={recipe.id}
            role="button"
            disabled={busy !== null}
            accessibilityLabel={t("shopping:recipe.add", { title: recipe.title })}
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
                {t("shopping:recipe.adding")}
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
      <Button
        variant="outline"
        label={t("shopping:cancel")}
        onPress={onClose}
      />
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
  const { t } = useTranslation()
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
          ? t("shopping:rename.title")
          : mode === "delete"
            ? t("shopping:delete.title")
            : t("shopping:options.title")
      }
    >
      {mode === "menu" && (
        <>
          <ListGroup>
            <ListRow
              icon={Pencil}
              title={t("shopping:options.rename")}
              onPress={() => {
                setName(list.name)
                setMode("rename")
              }}
            />
            {canDelete && (
              <ListRow
                icon={Trash2}
                title={t("shopping:options.delete")}
                destructive
                onPress={() => setMode("delete")}
              />
            )}
          </ListGroup>
          <Button variant="outline" label={t("shopping:options.close")} onPress={close} />
        </>
      )}
      {mode === "rename" && (
        <>
          <Input
            label={t("shopping:new.name")}
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label={t("shopping:cancel")}
              className="flex-1"
              onPress={() => setMode("menu")}
            />
            <Button
              label={t("shopping:rename.save")}
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
            {list.householdId
              ? t("shopping:delete.messageHousehold", {
                  name: list.name,
                  count: list.items.length,
                })
              : t("shopping:delete.message", {
                  name: list.name,
                  count: list.items.length,
                })}
          </Text>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label={t("shopping:delete.keep")}
              className="flex-1"
              onPress={() => setMode("menu")}
            />
            <Button
              variant="destructive"
              label={t("shopping:delete.confirm")}
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
  const { t } = useTranslation()
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
              {item.quantity === null
                ? t("shopping:item.fromRecipesNoAmount", {
                    count: recipes.length,
                  })
                : t("shopping:item.fromRecipes", { count: recipes.length })}
            </Text>
          ) : recipes[0] ? (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {recipes[0]}
              {item.quantity === null
                ? ` · ${t("shopping:item.noAmount")}`
                : ""}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        role="button"
        accessibilityLabel={t("shopping:item.remove", { name: item.name })}
        onPress={onRemove}
        className="h-11 w-11 items-center justify-center rounded-md active:bg-accent web:hover:bg-accent"
      >
        <Icon as={X} size={18} className="text-muted-foreground" />
      </Pressable>
    </View>
  )
}
