import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { Units } from "@/lib/format"
import type { Space } from "@/lib/mock-data"

export type Appearance = "system" | "light" | "dark"
/** Lets the prototype show the loading, empty and error states of the main lists. */
export type ListState = "ready" | "loading" | "empty" | "error"

type AppState = {
  /** Browsing with sample data, without an account or a running API. */
  demo: boolean
  setDemo: (value: boolean) => void
  units: Units
  setUnits: (value: Units) => void
  appearance: Appearance
  setAppearance: (value: Appearance) => void
  space: Space
  setSpace: (value: Space) => void
  listState: ListState
  setListState: (value: ListState) => void
  offline: boolean
  setOffline: (value: boolean) => void
}

const AppStateContext = createContext<AppState | null>(null)

/**
 * UI state for the clickable shell. It lives in memory only; nothing is saved yet.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(false)
  const [units, setUnits] = useState<Units>("metric")
  const [appearance, setAppearance] = useState<Appearance>("system")
  const [space, setSpace] = useState<Space>("personal")
  const [listState, setListState] = useState<ListState>("ready")
  const [offline, setOffline] = useState(false)

  const value = useMemo(
    () => ({
      demo,
      setDemo,
      units,
      setUnits,
      appearance,
      setAppearance,
      space,
      setSpace,
      listState,
      setListState,
      offline,
      setOffline,
    }),
    [demo, units, appearance, space, listState, offline]
  )

  return <AppStateContext value={value}>{children}</AppStateContext>
}

export function useAppState() {
  const state = useContext(AppStateContext)
  if (!state)
    throw new Error("useAppState must be used inside AppStateProvider")
  return state
}
