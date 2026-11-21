import { Search } from "lucide-react-native"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useShell } from "@/lib/shell"

/** Opens the search sheet. Put it in the `actions` of a screen. */
export function SearchButton() {
  const { t } = useTranslation("modules")
  const { setSearchOpen } = useShell()
  return (
    <Button
      variant="ghost"
      size="icon"
      icon={Search}
      label={t("search.open")}
      onPress={() => setSearchOpen(true)}
    />
  )
}
