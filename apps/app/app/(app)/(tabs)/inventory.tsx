import { Package, Plus } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, TextInput, View } from "react-native"

import {
  MAX_INVENTORY_QUANTITY,
  searchInventory,
  type InventoryItem,
} from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { Sheet } from "@/components/ui/sheet"
import { Stepper } from "@/components/ui/stepper"
import { useHousehold } from "@/lib/households"
import { useInventoryActions, useInventoryState } from "@/lib/inventory"
import { useIsWide } from "@/lib/layout"
import { useTheme } from "@/lib/theme"
import { inSpace } from "@/lib/space"

/** Home inventory: what the household owns and where it is kept. */
export default function Inventory() {
  const { t } = useTranslation("inventory")
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const { items: all, loaded, error, online, pending } = useInventoryState()
  const actions = useInventoryActions()
  const [query, setQuery] = useState("")
  // "new" is the form for a new item, an item is the form for editing it.
  const [form, setForm] = useState<InventoryItem | "new" | null>(null)

  const items = inSpace(all, household?.id ?? null)
  const shown = searchInventory(items, query)

  return (
    <Screen
      title={t("title")}
      subtitle={
        household
          ? t("sharedWith", { name: household.name })
          : t("ownItems")
      }
      narrow
      toolbar={
        <View className="gap-3">
          {!wide && <SpaceSwitcher />}
          {items.length > 0 && (
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t("search")}
            />
          )}
        </View>
      }
      actions={
        <Button
          size="header"
          icon={Plus}
          label={t("add")}
          onPress={() => setForm("new")}
        />
      }
    >
      <OfflineBanner online={online} pending={pending} />
      {!loaded && !error && <LoadingState label={t("loading")} rows={3} />}
      {!loaded && error && (
        <ErrorState
          title={t("loadError.title")}
          message={t("loadError.message")}
          onRetry={() => void actions.sync()}
        />
      )}
      {loaded && items.length === 0 && (
        <EmptyState
          icon={Package}
          title={t("empty.title")}
          message={t("empty.message")}
          action={t("add")}
          onAction={() => setForm("new")}
        />
      )}
      {loaded && items.length > 0 && shown.length === 0 && (
        <EmptyState
          icon={Package}
          title={t("noMatch.title")}
          message={t("noMatch.message")}
        />
      )}
      {shown.length > 0 && (
        <ListGroup>
          {shown.map((item) => (
            <ListRow
              key={item.id}
              icon={Package}
              title={item.name}
              detail={[
                item.place,
                item.quantity > 1 ? t("quantity", { count: item.quantity }) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => setForm(item)}
            />
          ))}
        </ListGroup>
      )}

      <ItemForm
        // A new key resets the fields each time the form opens for another item.
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        item={form === "new" || form === null ? null : form}
        open={form !== null}
        onClose={() => setForm(null)}
        householdName={household?.name}
        disabled={!ready}
        onSave={(fields) => {
          if (form && form !== "new") actions.edit(form.id, fields)
          else actions.add(fields, household?.id ?? null)
          setForm(null)
        }}
        onDelete={() => {
          if (form && form !== "new") actions.remove(form.id)
          setForm(null)
        }}
      />
    </Screen>
  )
}

type Fields = Pick<InventoryItem, "name" | "place" | "quantity" | "note">

function ItemForm({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  householdName,
  disabled,
}: {
  item: InventoryItem | null
  open: boolean
  onClose: () => void
  onSave: (fields: Fields) => void
  onDelete: () => void
  householdName?: string
  disabled: boolean
}) {
  const { t } = useTranslation("inventory")
  const { color } = useTheme()
  const [name, setName] = useState(item?.name ?? "")
  const [place, setPlace] = useState(item?.place ?? "")
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [note, setNote] = useState(item?.note ?? "")
  const trimmed = name.trim()
  const save = () => {
    if (trimmed && !disabled) {
      onSave({ name: trimmed, place: place.trim(), quantity, note: note.trim() })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? t("form.editTitle") : t("form.newTitle")}
    >
      <Input
        label={t("form.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("form.placeholder")}
        maxLength={200}
        autoFocus={!item}
      />
      <Input
        label={t("form.place")}
        value={place}
        onChangeText={setPlace}
        placeholder={t("form.placePlaceholder")}
        maxLength={200}
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("form.quantity")}
        </Text>
        <Stepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={MAX_INVENTORY_QUANTITY}
          label={t("form.quantity")}
        />
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">
          {t("form.note")}
        </Text>
        <TextInput
          accessibilityLabel={t("form.note")}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={2000}
          placeholderTextColor={color("muted-foreground")}
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground"
        />
      </View>
      {!item && (
        <Text className="text-sm text-muted-foreground">
          {householdName
            ? t("form.visibleHousehold", { name: householdName })
            : t("form.visiblePersonal")}
        </Text>
      )}
      <View className="flex-row gap-3">
        {item && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={item ? t("form.save") : t("form.create")}
          className="flex-1"
          disabled={!trimmed || disabled}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
