import { Redirect, router, useLocalSearchParams } from "expo-router"
import {
  BookPlus,
  Check,
  EllipsisVertical,
  ListChecks,
  Store,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, ScrollView, Text, TextInput, View } from "react-native"

import {
  parseQuantity,
  sortByRoute,
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
import { Chip } from "@/components/ui/chip"
import { SearchField } from "@/components/ui/search-field"
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
  itemsInView,
  sortingFor,
  storeCounts,
  storeIdOf,
  validView,
  type ShoppingView,
} from "@/lib/shopping-view"
import {
  useListKind,
  useShoppingActions,
  useShoppingList,
} from "@/lib/shopping"
import { useSupermarket, type SupermarketState } from "@/lib/supermarket"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"

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
  const { color } = useTheme()
  const placeholderColor = color("muted-foreground")
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
  const [storeOpen, setStoreOpen] = useState(false)
  const [view, setView] = useState<ShoppingView>({ kind: "all" })
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [moveOpen, setMoveOpen] = useState(false)
  const store = useSupermarket()

  // A supermarket without items has no view any more, so it falls back to all items.
  const shown = validView(view, list.items)
  const counts = useMemo(() => storeCounts(list.items), [list.items])
  const visible = itemsInView(list.items, shown)
  const open = visible.filter((i) => !i.checked)
  const checked = visible.filter((i) => i.checked)
  const showViews = counts.size > 0
  const sortedFor = sortingFor(shown, store.supermarket)
  const selectedIds = visible
    .filter((item) => selected.has(item.id))
    .map((item) => item.id)

  function startSelecting(first?: string) {
    setSelecting(true)
    setSelected(new Set(first ? [first] : []))
  }

  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
  }

  function toggleSelected(itemId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(itemId)) next.add(itemId)
      return next
    })
  }

  function moveSelected(target: string | null) {
    actions.moveItems(list.id, selectedIds, target)
    stopSelecting()
  }

  const storeLabel = (item: ShoppingItem) => {
    const id = storeIdOf(item)
    if (id === null || shown.kind === "store") return undefined
    const supermarket = store.supermarkets.find((s) => s.id === id)
    return supermarket ? store.nameOf(supermarket) : undefined
  }
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
        open: list.items.filter((i) => !i.checked).length,
        done: list.items.filter((i) => i.checked).length,
      })}
      back="/shopping"
      narrow
      actions={
        <>
          <Button
            variant={selecting ? "secondary" : "ghost"}
            size="icon"
            icon={ListChecks}
            label={
              selecting ? t("shopping:select.done") : t("shopping:select.start")
            }
            onPress={() => (selecting ? stopSelecting() : startSelecting())}
          />
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
            placeholderTextColor={placeholderColor}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addItem}
            returnKeyType="done"
            maxLength={200}
            className="h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground"
          />
          <Button
            size="icon"
            icon={Plus}
            label={t("shopping:list.addItemButton")}
            onPress={addItem}
          />
        </View>
        <View className="flex-row gap-2">
          <TextInput
            accessibilityLabel={t("shopping:list.amount")}
            placeholder={t("shopping:list.amountPlaceholder")}
            placeholderTextColor={placeholderColor}
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

      {showViews && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
          accessibilityLabel={t("shopping:view.label")}
        >
          <Chip
            label={t("shopping:view.all")}
            selected={shown.kind === "all"}
            onPress={() => setView({ kind: "all" })}
          />
          <Chip
            label={t("shopping:view.default")}
            selected={shown.kind === "default"}
            onPress={() => setView({ kind: "default" })}
          />
          {store.supermarkets
            .filter((option) => counts.has(option.id))
            .map((option) => (
              <Chip
                key={option.id}
                label={t("shopping:view.store", {
                  name: store.nameOf(option),
                  count: counts.get(option.id),
                })}
                selected={shown.kind === "store" && shown.id === option.id}
                onPress={() => setView({ kind: "store", id: option.id })}
              />
            ))}
        </ScrollView>
      )}

      {shown.kind === "store" ? (
        <View className="min-h-12 flex-row items-center gap-3 rounded-md border border-border px-3">
          <Icon as={Store} className="text-muted-foreground" />
          <Text className="flex-1 text-base text-foreground">
            {t("shopping:store.sortedFor", { name: store.nameOf(sortedFor) })}
          </Text>
        </View>
      ) : (
        <Pressable
          role="button"
          accessibilityLabel={t("shopping:store.change")}
          onPress={() => setStoreOpen(true)}
          className="min-h-12 flex-row items-center gap-3 rounded-md border border-border px-3 active:bg-accent web:hover:bg-accent"
        >
          <Icon as={Store} className="text-muted-foreground" />
          <Text className="flex-1 text-base text-foreground">
            {t("shopping:store.sortedFor", {
              name: store.nameOf(sortedFor),
            })}
          </Text>
        </Pressable>
      )}

      {selecting && (
        <View className="gap-2 rounded-md border border-border bg-accent/40 p-3">
          <Text role="status" className="text-base font-medium text-foreground">
            {t("shopping:select.count", { count: selectedIds.length })}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="outline"
              label={t("shopping:select.all")}
              disabled={visible.length === 0}
              onPress={() => setSelected(new Set(visible.map((i) => i.id)))}
            />
            <Button
              label={t("shopping:select.move")}
              disabled={selectedIds.length === 0}
              onPress={() => setMoveOpen(true)}
            />
            <Button
              variant="ghost"
              label={t("shopping:select.done")}
              onPress={stopSelecting}
            />
          </View>
        </View>
      )}

      {list.items.length === 0 && (
        <Text className="text-muted-foreground">
          {t("shopping:list.empty")}
        </Text>
      )}
      {list.items.length > 0 && visible.length === 0 && (
        <Text className="text-muted-foreground">
          {t("shopping:view.empty")}
        </Text>
      )}

      {sortByRoute(open, sortedFor).map((group) => (
        <View key={group.section} className="gap-1">
          <SectionTitle className="text-base text-muted-foreground">
            {t(`shopping:section.${group.section}`)}
          </SectionTitle>
          {group.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              units={units}
              storeLabel={storeLabel(item)}
              selecting={selecting}
              selected={selected.has(item.id)}
              onSelect={() => toggleSelected(item.id)}
              onLongPress={() => startSelecting(item.id)}
              onToggle={() =>
                actions.updateItem(list.id, item.id, { checked: true })
              }
              onRemove={() => actions.removeItem(list.id, item.id)}
            />
          ))}
        </View>
      ))}

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
              storeLabel={storeLabel(item)}
              selecting={selecting}
              selected={selected.has(item.id)}
              onSelect={() => toggleSelected(item.id)}
              onLongPress={() => startSelecting(item.id)}
              onToggle={() =>
                actions.updateItem(list.id, item.id, { checked: false })
              }
              onRemove={() => actions.removeItem(list.id, item.id)}
            />
          ))}
        </View>
      )}

      <StoreSheet
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        store={store}
        title={t("shopping:store.title")}
        hint={t("shopping:store.hint")}
        currentId={store.supermarket.id}
        onChoose={(id) => store.choose(id ?? store.supermarket.id)}
      />
      <StoreSheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        store={store}
        title={t("shopping:select.moveTitle")}
        hint={t("shopping:select.moveHint")}
        defaultRow
        onChoose={(id) => {
          setMoveOpen(false)
          moveSelected(id)
        }}
      />
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

/**
 * Pick a supermarket from the list the app knows. Searchable, because there are many. With
 * `defaultRow` the default list (no supermarket) is offered too and chosen as null.
 */
function StoreSheet({
  open,
  onClose,
  store,
  title,
  hint,
  currentId,
  defaultRow,
  onChoose,
}: {
  open: boolean
  onClose: () => void
  store: SupermarketState
  title: string
  hint: string
  currentId?: string
  defaultRow?: boolean
  onChoose: (id: string | null) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const options = store.supermarkets.filter(
    (option) => !needle || store.nameOf(option).toLowerCase().includes(needle)
  )

  function close() {
    setQuery("")
    onClose()
  }

  function choose(id: string | null) {
    onChoose(id)
    close()
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <Text className="text-muted-foreground">{hint}</Text>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t("shopping:store.search")}
      />
      <ScrollView className="max-h-72">
        {defaultRow && !needle && (
          <ListGroup>
            <ListRow
              title={t("shopping:view.default")}
              onPress={() => choose(null)}
            />
          </ListGroup>
        )}
        {options.length === 0 ? (
          <Text className="py-3 text-foreground">
            {t("shopping:store.none")}
          </Text>
        ) : (
          <ListGroup>
            {options.map((option) => (
              <ListRow
                key={option.id}
                title={store.nameOf(option)}
                right={
                  option.id === currentId ? (
                    <Icon as={Check} className="text-primary" />
                  ) : undefined
                }
                onPress={() => choose(option.id)}
              />
            ))}
          </ListGroup>
        )}
      </ScrollView>
      <Button
        variant="outline"
        label={t("shopping:options.close")}
        onPress={close}
      />
    </Sheet>
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
  // Ingredients left out because they are pantry staples. Shown until the person closes the sheet.
  const [skipped, setSkipped] = useState<string[] | null>(null)

  function close() {
    setSkipped(null)
    setMessage(null)
    onClose()
  }

  async function add(recipeId: string, title: string) {
    setBusy(recipeId)
    setMessage(null)
    try {
      const result = await actions.addRecipe(list.id, recipeId)
      if (result.skipped.length > 0) setSkipped(result.skipped)
      else close()
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
    <Sheet
      open={open}
      onClose={close}
      title={
        skipped ? t("shopping:recipe.addedTitle") : t("shopping:recipe.title")
      }
    >
      {skipped ? (
        <>
          <Text role="status" className="text-foreground">
            {t("shopping:recipe.skipped", { items: skipped.join(", ") })}
          </Text>
          <Button label={t("shopping:recipe.done")} onPress={close} />
        </>
      ) : (
        <>
          <Text className="text-muted-foreground">
            {t("shopping:recipe.hint")}
          </Text>
          {recipes.isPending && (
            <LoadingState label={t("shopping:recipe.loading")} rows={1} />
          )}
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
                accessibilityLabel={t("shopping:recipe.add", {
                  title: recipe.title,
                })}
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
            onPress={close}
          />
        </>
      )}
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
          <Button
            variant="outline"
            label={t("shopping:options.close")}
            onPress={close}
          />
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
  storeLabel,
  selecting,
  selected,
  onSelect,
  onLongPress,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem
  units: "metric" | "imperial"
  /** The supermarket the item was moved to, when the view does not already say it. */
  storeLabel?: string
  selecting: boolean
  selected: boolean
  onSelect: () => void
  onLongPress: () => void
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
        aria-checked={selecting ? selected : item.checked}
        accessibilityLabel={
          selecting ? t("shopping:select.item", { name: item.name }) : item.name
        }
        onPress={selecting ? onSelect : onToggle}
        onLongPress={selecting ? undefined : onLongPress}
        className={cn(
          "min-h-14 flex-1 flex-row items-center gap-3 rounded-md px-1 py-2 active:bg-accent web:hover:bg-accent",
          selecting && selected && "bg-accent"
        )}
      >
        <CheckboxBox checked={selecting ? selected : item.checked} />
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
          {storeLabel && (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {storeLabel}
            </Text>
          )}
        </View>
      </Pressable>
      {!selecting && (
        <Pressable
          role="button"
          accessibilityLabel={t("shopping:item.remove", { name: item.name })}
          onPress={onRemove}
          className="h-11 w-11 items-center justify-center rounded-md active:bg-accent web:hover:bg-accent"
        >
          <Icon as={X} size={18} className="text-muted-foreground" />
        </Pressable>
      )}
    </View>
  )
}
