import { useEffect } from "react"

import { Segmented } from "@/components/ui/segmented"
import { useAppState } from "@/lib/app-state"
import { useHousehold } from "@/lib/households"

/**
 * Switch between your own recipes and lists and the ones shared with your household.
 * Without a household there is nothing to switch to, so it is not shown.
 */
export function SpaceSwitcher({ compact }: { compact?: boolean }) {
  const { space, setSpace } = useAppState()
  const { household, isPending, isError } = useHousehold()
  const noHousehold = !isPending && !isError && !household

  // Never stay on the household space after leaving the household.
  useEffect(() => {
    if (noHousehold && space === "household") setSpace("personal")
  }, [noHousehold, space, setSpace])

  if (noHousehold) return null

  return (
    <Segmented
      label="Space"
      value={space}
      onChange={setSpace}
      className={compact ? undefined : "self-stretch"}
      options={[
        { value: "personal", label: "Personal" },
        { value: "household", label: household?.name ?? "Household" },
      ]}
    />
  )
}
