import { Settings } from "lucide-react-native"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

/**
 * The settings button of an area (Money, Food, ...). Put it in the `actions` of the area screen;
 * `children` get the open state, so the sheet they render is closed by the same button.
 */
export function AreaSettingsButton({
  children,
}: {
  children: (sheet: { open: boolean; onClose: () => void }) => ReactNode
}) {
  const { t } = useTranslation("modules")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        icon={Settings}
        label={t("areaSettings.open")}
        onPress={() => setOpen(true)}
      />
      {children({ open, onClose: () => setOpen(false) })}
    </>
  )
}
