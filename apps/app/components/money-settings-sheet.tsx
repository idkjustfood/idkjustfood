import { Plus, Trash2 } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { currencies, type Currency } from "@workspace/schemas"

import { categoryName } from "@/components/money-parts"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import type { MoneyContext } from "@/components/money-screen"

/**
 * The money settings of the selected space: its currency, and its categories (add, rename,
 * delete). A household has its own currency and categories, separate from the person's own.
 */
export function MoneySettingsSheet({
  open,
  onClose,
  context,
}: {
  open: boolean
  onClose: () => void
  context: MoneyContext
}) {
  const { t } = useTranslation("money")
  const { money, householdId, householdName, actions } = context
  const [newName, setNewName] = useState("")
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)

  const add = () => {
    const name = newName.trim()
    if (!name) return
    actions.addCategory(name, householdId)
    setNewName("")
  }
  const saveRename = () => {
    const name = editing?.name.trim()
    if (editing && name) actions.renameCategory(editing.id, name)
    setEditing(null)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("settings.title")}>
      <Text className="text-sm text-muted-foreground">
        {householdName
          ? t("settings.forHousehold", { name: householdName })
          : t("settings.forPersonal")}
      </Text>

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("settings.currency")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {currencies.map((currency: Currency) => (
            <Chip
              key={currency}
              label={currency}
              selected={money.currency === currency}
              onPress={() => actions.setCurrency(householdId, currency)}
            />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("settings.categories")}
        </Text>
        {money.categories.map((category) =>
          editing?.id === category.id ? (
            <View key={category.id} className="flex-row items-end gap-2">
              <View className="flex-1">
                <Input
                  label={t("settings.categoryName")}
                  value={editing.name}
                  onChangeText={(name) => setEditing({ id: category.id, name })}
                  maxLength={200}
                  autoFocus
                  onSubmitEditing={saveRename}
                />
              </View>
              <Button label={t("form.save")} onPress={saveRename} />
            </View>
          ) : (
            <View
              key={category.id}
              className="min-h-12 flex-row items-center gap-2 rounded-md border border-border bg-card pl-4"
            >
              <Pressable
                role="button"
                accessibilityLabel={t("settings.rename", {
                  name: categoryName(t, category),
                })}
                onPress={() =>
                  setEditing({ id: category.id, name: categoryName(t, category) })
                }
                className="flex-1 py-3"
              >
                <Text className="text-base text-foreground">
                  {categoryName(t, category)}
                </Text>
              </Pressable>
              <Pressable
                role="button"
                accessibilityLabel={t("settings.deleteCategory", {
                  name: categoryName(t, category),
                })}
                onPress={() => actions.removeCategory(category.id)}
                className="h-12 w-12 items-center justify-center active:bg-accent"
              >
                <Icon as={Trash2} className="text-destructive" />
              </Pressable>
            </View>
          )
        )}
        <Text className="text-sm text-muted-foreground">
          {t("settings.deleteHint")}
        </Text>
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <Input
              label={t("settings.newCategory")}
              value={newName}
              onChangeText={setNewName}
              maxLength={200}
              onSubmitEditing={add}
            />
          </View>
          <Button
            icon={Plus}
            label={t("settings.addCategory")}
            disabled={!newName.trim()}
            onPress={add}
          />
        </View>
      </View>
    </Sheet>
  )
}
