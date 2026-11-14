import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { Units } from "@/lib/format"
import type { Space } from "@/lib/mock-data"
import i18n, { deviceLanguage, supportedLanguages } from "@/lib/i18n"
import {
  loadLanguage,
  loadSpace,
  loadUnits,
  saveLanguage,
  saveSpace,
  saveUnits,
} from "@/lib/preferences"

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
  /** The chosen language, or "system" to follow the device. Remembered on this device. */
  language: string
  setLanguage: (value: string) => void
  /** The selected household, or null for the personal space. Remembered on this device. */
  householdId: string | null
  /** `space` is "household" whenever a household is selected. */
  space: Space
  /** Selects a household (or null for personal) and remembers it. */
  setHouseholdId: (value: string | null) => void
  /** Falls back to the personal space for now, without forgetting the saved choice. */
  fallBackToPersonal: () => void
  listState: ListState
  setListState: (value: ListState) => void
  offline: boolean
  setOffline: (value: boolean) => void
}

const AppStateContext = createContext<AppState | null>(null)

/**
 * UI state. It lives in memory, except the chosen units, which stay on this device.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(false)
  const [units, setUnitsState] = useState<Units>("metric")
  const [appearance, setAppearance] = useState<Appearance>("system")
  const [language, setLanguageState] = useState("system")
  const [householdId, setHouseholdIdState] = useState<string | null>(null)
  const [listState, setListState] = useState<ListState>("ready")
  const [offline, setOffline] = useState(false)
  const space: Space = householdId ? "household" : "personal"

  // The chosen units stay on this device.
  useEffect(() => {
    let cancelled = false
    loadUnits().then((saved) => {
      if (saved && !cancelled) setUnitsState(saved)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const setUnits = useCallback((value: Units) => {
    setUnitsState(value)
    void saveUnits(value)
  }, [])

  // So does the language. "system" follows the device, and English is the fallback.
  useEffect(() => {
    loadLanguage().then((saved) => {
      if (saved && supportedLanguages.includes(saved)) setLanguageState(saved)
    })
  }, [])
  useEffect(() => {
    void i18n.changeLanguage(
      language === "system" ? deviceLanguage() : language
    )
  }, [language])
  const setLanguage = useCallback((value: string) => {
    setLanguageState(value)
    void saveLanguage(value === "system" ? null : value)
  }, [])

  // So does the selected space. A choice made before it has loaded wins.
  const touched = useRef(false)
  useEffect(() => {
    loadSpace().then((saved) => {
      if (saved && !touched.current) setHouseholdIdState(saved)
    })
  }, [])
  const setHouseholdId = useCallback((value: string | null) => {
    touched.current = true
    setHouseholdIdState(value)
    void saveSpace(value)
  }, [])
  const fallBackToPersonal = useCallback(() => {
    touched.current = true
    setHouseholdIdState(null)
  }, [])

  const value = useMemo(
    () => ({
      demo,
      setDemo,
      units,
      setUnits,
      appearance,
      setAppearance,
      language,
      setLanguage,
      householdId,
      space,
      setHouseholdId,
      fallBackToPersonal,
      listState,
      setListState,
      offline,
      setOffline,
    }),
    [
      demo,
      units,
      setUnits,
      appearance,
      language,
      setLanguage,
      householdId,
      space,
      setHouseholdId,
      fallBackToPersonal,
      listState,
      offline,
    ]
  )

  return <AppStateContext value={value}>{children}</AppStateContext>
}

export function useAppState() {
  const state = useContext(AppStateContext)
  if (!state)
    throw new Error("useAppState must be used inside AppStateProvider")
  return state
}
