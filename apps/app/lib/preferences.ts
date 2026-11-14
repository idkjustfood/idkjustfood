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
