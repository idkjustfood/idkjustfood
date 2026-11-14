import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Larger data that stays on this device between visits (shopping lists and
 * the changes waiting to be sent). Phones use async storage; the web version
 * uses the browser's local storage, see `device-storage.web.ts`.
 * Secure storage is not used here: it only holds a few kilobytes.
 */
export const deviceStorage = {
  read: (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  write: (key: string, value: string): Promise<void> =>
    AsyncStorage.setItem(key, value),
}
