import { Package, RotateCcw, X } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { useHousehold } from "@/lib/households"
import {
  useAddStaple,
  usePantry,
  useRemoveStaple,
  useResetPantry,
} from "@/lib/pantry"

/**
 * The things a person or household always has at home. They are left out when a recipe is added to a
 * shopping list. Shows the list of the selected space (personal or household).
 */
export default function PantryScreen() {
  const { t } = useTranslation()
  const { household } = useHousehold()
  const space = household?.id ?? null
  const pantry = usePantry(space)
  const add = useAddStaple(space)
  const remove = useRemoveStaple(space)
  const reset = useResetPantry(space)
  const [name, setName] = useState("")
  const [confirmReset, setConfirmReset] = useState(false)

  const submit = () => {
    const value = name.trim()
    if (!value) return
    setName("")
    add.mutate(value)
  }
  const actionError = add.error ?? remove.error ?? reset.error

  return (
    <Screen
      title={t("settings:pantry.title")}
      subtitle={
        household
          ? t("settings:pantry.subtitleHousehold", { name: household.name })
          : t("settings:pantry.subtitlePersonal")
      }
      back="/settings"
      narrow
    >
      <SpaceSwitcher />

      <Text className="px-1 text-base text-muted-foreground">
        {t("settings:pantry.hint")}
      </Text>

      {pantry.isPending ? (
        <LoadingState label={t("settings:pantry.loading")} rows={3} />
      ) : pantry.isError ? (
        <ErrorState
          title={t("settings:pantry.loadError")}
          message={pantry.error.message}
          onRetry={() => pantry.refetch()}
        />
      ) : (
        <>
          <View className="gap-3">
            <Input
              label={t("settings:pantry.addLabel")}
              value={name}
              onChangeText={setName}
              placeholder={t("settings:pantry.addPlaceholder")}
              onSubmitEditing={submit}
              maxLength={200}
            />
            <Button
              label={t("settings:pantry.add")}
              disabled={!name.trim() || add.isPending}
              onPress={submit}
            />
          </View>

          {pantry.data.items.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t("settings:pantry.emptyTitle")}
              message={t("settings:pantry.emptyMessage")}
            />
          ) : (
            <ListGroup
              title={t("settings:pantry.count", {
                count: pantry.data.items.length,
              })}
            >
              {pantry.data.items.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  right={
                    <Button
                      variant="ghost"
                      size="icon"
                      icon={X}
                      label={t("settings:pantry.remove", { name: item.name })}
                      disabled={remove.isPending}
                      onPress={() => remove.mutate(item.id)}
                    />
                  }
                />
              ))}
            </ListGroup>
          )}

          {actionError && (
            <Text role="alert" className="px-1 text-sm text-destructive">
              {actionError.message}
            </Text>
          )}

          <Button
            variant="outline"
            icon={RotateCcw}
            label={t("settings:pantry.reset")}
            onPress={() => setConfirmReset(true)}
          />
        </>
      )}

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t("settings:pantry.resetTitle")}
      >
        <Text className="text-base text-muted-foreground">
          {t("settings:pantry.resetText")}
        </Text>
        <Button
          variant="destructive"
          label={t("settings:pantry.resetConfirm")}
          disabled={reset.isPending}
          onPress={() => {
            reset.mutate()
            setConfirmReset(false)
          }}
        />
        <Button
          variant="outline"
          label={t("settings:pantry.cancel")}
          onPress={() => setConfirmReset(false)}
        />
      </Sheet>
    </Screen>
  )
}
