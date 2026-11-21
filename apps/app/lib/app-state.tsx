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
import { parseDisabled, toggleModule } from "@/lib/modules"
import {
  loadDisabledModules,
  loadLanguage,
  loadSpace,
  loadTheme,
  loadUnits,
  saveDisabledModules,
  saveLanguage,
  saveSpace,
  saveTheme,
  saveUnits,
} from "@/lib/preferences"
import { DEFAULT_THEME_ID, isThemeId } from "@/lib/themes"

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
  /** The id of the chosen theme (`lib/themes.ts`). Remembered on this device. */
  themeId: string
  setThemeId: (value: string) => void
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
  /** Ids of the modules switched off. Remembered on this device (see `lib/modules.ts`). */
  disabledModules: string[]
  setModuleEnabled: (id: string, on: boolean) => void
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
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID)
  const [householdId, setHouseholdIdState] = useState<string | null>(null)
  const [disabledModules, setDisabledModules] = useState<string[]>([])
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

  // So does the theme. An unknown id (a theme that was removed) is ignored.
  useEffect(() => {
    loadTheme().then((saved) => {
      if (isThemeId(saved)) setThemeIdState(saved)
    })
  }, [])
  const setThemeId = useCallback((value: string) => {
    setThemeIdState(value)
    void saveTheme(value)
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

  // So do the modules that are switched off.
  useEffect(() => {
    loadDisabledModules().then((saved) => {
      const ids = parseDisabled(saved)
      // A switch made before the saved value arrived is kept.
      if (ids.length) setDisabledModules((now) => [...new Set([...ids, ...now])])
    })
  }, [])
  const setModuleEnabled = useCallback((id: string, on: boolean) => {
    setDisabledModules((now) => {
      const next = toggleModule(now, id, on)
      void saveDisabledModules(next)
      return next
    })
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
      themeId,
      setThemeId,
      language,
      setLanguage,
      householdId,
      space,
      setHouseholdId,
      fallBackToPersonal,
      disabledModules,
      setModuleEnabled,
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
      themeId,
      setThemeId,
      language,
      setLanguage,
      householdId,
      space,
      setHouseholdId,
      fallBackToPersonal,
      disabledModules,
      setModuleEnabled,
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
