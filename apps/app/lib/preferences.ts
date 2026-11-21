import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

import type { Units } from "@/lib/format"

/**
 * Small settings that stay on this device between visits: the browser's local
 * storage on the web, secure storage on phones. A blocked or broken store just
 * means the setting is forgotten; nothing else depends on it.
 */
const UNITS_KEY = "idkjustfood.units"

export async function loadUnits(): Promise<Units | null> {
  try {
    const value =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(UNITS_KEY)
        : await SecureStore.getItemAsync(UNITS_KEY)
    return value === "metric" || value === "imperial" ? value : null
  } catch {
    return null
  }
}

export async function saveUnits(units: Units) {
  try {
    if (Platform.OS === "web")
      globalThis.localStorage?.setItem(UNITS_KEY, units)
    else await SecureStore.setItemAsync(UNITS_KEY, units)
  } catch {
    // Not saved this time.
  }
}

const SPACE_KEY = "idkjustfood.space"

/** The household that was selected last, or null for the personal space. */
export async function loadSpace(): Promise<string | null> {
  try {
    const value =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(SPACE_KEY)
        : await SecureStore.getItemAsync(SPACE_KEY)
    return value || null
  } catch {
    return null
  }
}

export async function saveSpace(householdId: string | null) {
  try {
    if (Platform.OS === "web") {
      if (householdId) globalThis.localStorage?.setItem(SPACE_KEY, householdId)
      else globalThis.localStorage?.removeItem(SPACE_KEY)
    } else if (householdId) {
      await SecureStore.setItemAsync(SPACE_KEY, householdId)
    } else {
      await SecureStore.deleteItemAsync(SPACE_KEY)
    }
  } catch {
    // Not saved this time.
  }
}

const LANGUAGE_KEY = "idkjustfood.language"

/** The language picked in settings, or null to follow the device. */
export async function loadLanguage(): Promise<string | null> {
  try {
    const value =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(LANGUAGE_KEY)
        : await SecureStore.getItemAsync(LANGUAGE_KEY)
    return value || null
  } catch {
    return null
  }
}

export async function saveLanguage(language: string | null) {
  try {
    if (Platform.OS === "web") {
      if (language) globalThis.localStorage?.setItem(LANGUAGE_KEY, language)
      else globalThis.localStorage?.removeItem(LANGUAGE_KEY)
    } else if (language) {
      await SecureStore.setItemAsync(LANGUAGE_KEY, language)
    } else {
      await SecureStore.deleteItemAsync(LANGUAGE_KEY)
    }
  } catch {
    // Not saved this time.
  }
}

const SUPERMARKET_KEY = "idkjustfood.supermarket"

/** The supermarket picked for the shopping lists, or null for the standard one. */
export async function loadSupermarket(): Promise<string | null> {
  try {
    const value =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(SUPERMARKET_KEY)
        : await SecureStore.getItemAsync(SUPERMARKET_KEY)
    return value || null
  } catch {
    return null
  }
}

export async function saveSupermarket(id: string) {
  try {
    if (Platform.OS === "web")
      globalThis.localStorage?.setItem(SUPERMARKET_KEY, id)
    else await SecureStore.setItemAsync(SUPERMARKET_KEY, id)
  } catch {
    // Not saved this time.
  }
}

const THEME_KEY = "idkjustfood.theme"

/** The id of the chosen theme, or null for the default one. */
export async function loadTheme(): Promise<string | null> {
  try {
    const value =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(THEME_KEY)
        : await SecureStore.getItemAsync(THEME_KEY)
    return value || null
  } catch {
    return null
  }
}

export async function saveTheme(id: string) {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(THEME_KEY, id)
    else await SecureStore.setItemAsync(THEME_KEY, id)
  } catch {
    // Not saved this time.
  }
}

const MODULES_KEY = "idkjustfood.disabled-modules"

/** The ids of the modules switched off in settings, as saved text (see `parseDisabled`). */
export async function loadDisabledModules(): Promise<string | null> {
  try {
    return Platform.OS === "web"
      ? (globalThis.localStorage?.getItem(MODULES_KEY) ?? null)
      : await SecureStore.getItemAsync(MODULES_KEY)
  } catch {
    return null
  }
}

export async function saveDisabledModules(ids: readonly string[]) {
  try {
    const value = JSON.stringify(ids)
    if (Platform.OS === "web") globalThis.localStorage?.setItem(MODULES_KEY, value)
    else await SecureStore.setItemAsync(MODULES_KEY, value)
  } catch {
    // Not saved this time.
  }
}
