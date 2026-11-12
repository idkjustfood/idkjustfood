import { Segmented } from "@/components/ui/segmented"
import { useAppState } from "@/lib/app-state"
import { household } from "@/lib/mock-data"

/** Switch between your own recipes and lists and the ones shared with your household. */
export function SpaceSwitcher({ compact }: { compact?: boolean }) {
  const { space, setSpace } = useAppState()
  return (
    <Segmented
      label="Space"
      value={space}
      onChange={setSpace}
      className={compact ? undefined : "self-stretch"}
      options={[
        { value: "personal", label: "Personal" },
        { value: "household", label: household.name },
      ]}
    />
  )
}
