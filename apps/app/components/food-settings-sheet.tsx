import { router } from "expo-router"
import { Package } from "lucide-react-native"
import { useTranslation } from "react-i18next"

import { ListGroup, ListRow } from "@/components/list-row"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Sheet } from "@/components/ui/sheet"
import { Text, View } from "react-native"
import { useAppState } from "@/lib/app-state"

/** The settings of the Food area: units (metric or imperial) and the pantry staples. */
export function FoodSettingsSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation("modules")
  const { units, setUnits } = useAppState()
  return (
    <Sheet open={open} onClose={onClose} title={t("areaSettings.foodTitle")}>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("areaSettings.units")}
        </Text>
        <Segmented
          label={t("areaSettings.units")}
          value={units}
          onChange={setUnits}
          options={[
            { value: "metric", label: t("areaSettings.metric") },
            { value: "imperial", label: t("areaSettings.imperial") },
          ]}
        />
      </View>
      <ListGroup>
        <ListRow
          icon={Package}
          title={t("areaSettings.pantry")}
          detail={t("areaSettings.pantryDetail")}
          onPress={() => {
            onClose()
            router.push("/settings/pantry")
          }}
        />
      </ListGroup>
      <Button
        variant="outline"
        label={t("areaSettings.close")}
        onPress={onClose}
      />
    </Sheet>
  )
}
